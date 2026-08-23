import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Order, OrderCreateBody } from '@gx-portal/types';
import * as path from 'path';
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

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

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

    // Download phase: on failure, remove partial files. Do not delete after
    // createOrder — daemon may already reference those paths.
    try {
      if (dto.fastq_r1_url?.trim()) {
        fastqR1 = await this.fastq.downloadToOrderDir(
          serviceCode,
          orderId,
          dto.fastq_r1_url.trim(),
          'r1',
        );
      }
      if (dto.fastq_r2_url?.trim()) {
        const r1Name = fastqR1 ? path.basename(fastqR1) : undefined;
        fastqR2 = await this.fastq.downloadToOrderDir(
          serviceCode,
          orderId,
          dto.fastq_r2_url.trim(),
          'r2',
          r1Name,
        );
      }
    } catch (err) {
      await this.fastq.cleanupOrderDir(serviceCode, orderId);
      throw err;
    }

    const body = this.buildCreateBody(serviceCode, dto, orderId, fastqR1, fastqR2);
    const order = await this.orders.createOrder(serviceCode, body, user, {
      useProvidedOrderId: true,
    });

    if (dto.start) {
      this.logger.log(`Starting order ${order.order_id} (external API start=true)`);
      try {
        return await this.orders.startOrder(order.order_id, undefined, user);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new BadGatewayException({
          message: `Order ${order.order_id} was created but start failed: ${msg}`,
          order_id: order.order_id,
          order,
        });
      }
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
      const nipt = (params.nipt ?? {}) as Record<string, unknown>;
      const required = [
        'patient_name',
        'patient_birth',
        'patient_gender',
        'gestational_age_weeks',
        'gestational_age_days',
        'pregnancy_type',
        'estimated_delivery_date',
        'hospital_name',
        'doctor',
        'sample_collection_date',
        'package_code',
        'report_language',
        'report_type',
      ] as const;
      for (const key of required) {
        const v = nipt[key];
        if (v === undefined || v === null || v === '') {
          throw new BadRequestException(`params.nipt.${key} is required`);
        }
      }
      return;
    }

    const carrier = (params.carrier ?? {}) as Record<string, unknown>;
    const wes = str(params.wes_panel_id) || str(carrier.wes_panel_id);
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
      const carrierIn = (rawParams.carrier as Record<string, unknown> | undefined) ?? {};
      const wes = str(rawParams.wes_panel_id) || str(carrierIn.wes_panel_id);
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
        ...carrierIn,
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
