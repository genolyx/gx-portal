import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Order, OrderCreateBody } from '@gx-portal/types';
import { OrdersService } from '../orders/orders.service';
import { OrderRegistryService, type RequestUser } from '../orders/order-registry.service';
import { FastqDownloadService } from './fastq-download.service';
import type { ExternalCreateOrderDto } from './dto/external-create-order.dto';

const PORTAL_SERVICES = new Set([
  'carrier_screening',
  'whole_exome',
  'health_screening',
  'sgnipt',
]);

const PACKAGE_CODE: Record<string, string> = {
  carrier_screening: 'CarrierScreening',
  whole_exome: 'WholeExome',
  health_screening: 'HealthScreening',
};

@Injectable()
export class ExternalOrdersService {
  private readonly logger = new Logger(ExternalOrdersService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly registry: OrderRegistryService,
    private readonly fastq: FastqDownloadService,
  ) {}

  async create(
    serviceCode: string,
    dto: ExternalCreateOrderDto,
    user: RequestUser,
  ): Promise<Order> {
    if (!PORTAL_SERVICES.has(serviceCode)) {
      throw new BadRequestException(
        `Unsupported serviceCode. Allowed: ${[...PORTAL_SERVICES].join(', ')}`,
      );
    }

    this.validateServiceParams(serviceCode, dto);

    const clientId = this.registry.resolveClientIdForCreate(user);
    const orderId = this.registry.allocateOrderId(serviceCode, clientId);

    let fastqR1 = dto.fastq_r1_path?.trim() || undefined;
    let fastqR2 = dto.fastq_r2_path?.trim() || undefined;

    if (dto.fastq_r1_url?.trim()) {
      fastqR1 = await this.fastq.downloadToOrderDir(
        serviceCode,
        orderId,
        dto.fastq_r1_url.trim(),
        'r1',
      );
    }
    if (dto.fastq_r2_url?.trim()) {
      fastqR2 = await this.fastq.downloadToOrderDir(
        serviceCode,
        orderId,
        dto.fastq_r2_url.trim(),
        'r2',
      );
    }

    const body = this.buildCreateBody(serviceCode, dto, orderId, fastqR1, fastqR2);
    const order = await this.orders.createOrder(serviceCode, body, user, {
      useProvidedOrderId: true,
    });

    if (dto.start) {
      this.logger.log(`Starting order ${order.order_id} (external API start=true)`);
      return this.orders.startOrder(order.order_id, undefined, user);
    }
    return order;
  }

  getOrder(orderId: string, user: RequestUser): Promise<Order> {
    return this.orders.getOrder(orderId, user);
  }

  startOrder(orderId: string, user: RequestUser): Promise<Order> {
    return this.orders.startOrder(orderId, undefined, user);
  }

  private validateServiceParams(serviceCode: string, dto: ExternalCreateOrderDto): void {
    const params = dto.params ?? {};
    if (serviceCode === 'sgnipt') {
      const nipt = params.nipt ?? {};
      const required: [keyof typeof nipt, string][] = [
        ['patient_name', 'params.nipt.patient_name'],
        ['patient_birth', 'params.nipt.patient_birth'],
        ['patient_gender', 'params.nipt.patient_gender'],
        ['gestational_age_weeks', 'params.nipt.gestational_age_weeks'],
        ['gestational_age_days', 'params.nipt.gestational_age_days'],
        ['pregnancy_type', 'params.nipt.pregnancy_type'],
        ['estimated_delivery_date', 'params.nipt.estimated_delivery_date'],
        ['hospital_name', 'params.nipt.hospital_name'],
        ['doctor', 'params.nipt.doctor'],
        ['sample_collection_date', 'params.nipt.sample_collection_date'],
        ['package_code', 'params.nipt.package_code'],
        ['report_language', 'params.nipt.report_language'],
        ['report_type', 'params.nipt.report_type'],
      ];
      for (const [key, label] of required) {
        const v = nipt[key];
        if (v === undefined || v === null || v === '') {
          throw new BadRequestException(`${label} is required`);
        }
      }
      return;
    }

    // Exome family
    const wes =
      params.wes_panel_id?.trim() ||
      params.carrier?.wes_panel_id?.trim() ||
      '';
    if (!wes) {
      throw new BadRequestException('params.wes_panel_id is required');
    }
  }

  private buildCreateBody(
    serviceCode: string,
    dto: ExternalCreateOrderDto,
    orderId: string,
    fastqR1?: string,
    fastqR2?: string,
  ): OrderCreateBody {
    const rawParams = { ...(dto.params ?? {}) } as Record<string, unknown>;

    if (serviceCode === 'sgnipt') {
      const nipt = { ...((rawParams.nipt as Record<string, unknown>) ?? {}) };
      rawParams.nipt = nipt;
    } else {
      const wes =
        String(rawParams.wes_panel_id ?? '').trim() ||
        String((rawParams.carrier as Record<string, unknown> | undefined)?.wes_panel_id ?? '').trim();
      const carrier = {
        test_category: 'standard_carrier',
        patient_gender: 'Female',
        affected: 'No',
        report_language: 'EN',
        report_type: 'Portal',
        sample_specimen_type: 'Blood',
        report_mode: 'single',
        capture_panel_id: 'twist-exome2',
        reuse_prior_pipeline_outputs: false,
        include_pgx: true,
        ...((rawParams.carrier as Record<string, unknown>) ?? {}),
        package_code: PACKAGE_CODE[serviceCode],
        wes_panel_id: wes,
      };
      rawParams.wes_panel_id = wes;
      rawParams.carrier = carrier;
      if (rawParams.panel_filter_after_analysis === undefined) {
        rawParams.panel_filter_after_analysis = true;
      }
    }

    return {
      order_id: orderId,
      description: dto.description,
      work_dir: dto.work_dir,
      fastq_r1_path: fastqR1,
      fastq_r2_path: fastqR2,
      params: rawParams,
    };
  }
}
