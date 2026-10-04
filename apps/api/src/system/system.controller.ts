import { Controller, Get, Put, Post, Body, Query, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'stream';
import { SystemService } from './system.service';
import { HostResourcesService } from './host-resources.service';
import { ExternalKeysService } from './external-keys.service';
import { InterpretationSettingsService } from '../review/interpretation-settings.service';
import { GvcPartnerService } from '../review/gvc-partner.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { API_VERSION } from '../version';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly hostResourcesService: HostResourcesService,
    private readonly externalKeys: ExternalKeysService,
    private readonly interpretation: InterpretationSettingsService,
    private readonly gvc: GvcPartnerService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Gx-portal + daemon health check' })
  async health() {
    const daemonHealth = await this.systemService.health().catch(() => ({ status: 'unreachable' }));
    return { portal: 'ok', version: API_VERSION, daemon: daemonHealth };
  }

  @Get('queue')
  @ApiOperation({ summary: 'Queue summary from daemon' })
  queue() {
    return this.systemService.queueSummary();
  }

  @Get('dashboard/bucket')
  @ApiOperation({ summary: 'Orders in a dashboard status bucket' })
  dashboardBucket(
    @Query('bucket') bucket: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('service_code') serviceCode?: string,
  ) {
    return this.systemService.dashboardBucket({
      bucket,
      sort,
      order,
      service_code: serviceCode,
    });
  }

  @Get('services')
  @ApiOperation({ summary: 'Available services from daemon' })
  services() {
    return this.systemService.services();
  }

  @Get('resources')
  @ApiOperation({ summary: 'System resource metrics' })
  resources() {
    return this.systemService.resources();
  }

  @Get('log')
  @ApiOperation({ summary: 'Daemon log tail' })
  log(@Query('lines') lines?: string) {
    return this.systemService.daemonLog(lines ? parseInt(lines, 10) : 200);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get current portal/daemon config' })
  getConfig() {
    return this.systemService.getConfig();
  }

  @Put('config')
  @ApiOperation({ summary: 'Update daemon connection URL at runtime' })
  setConfig(@Body() body: { daemonUrl: string; apiKey?: string }) {
    this.systemService.setConfig(body.daemonUrl, body.apiKey);
    return { ok: true, daemonUrl: body.daemonUrl };
  }

  @Get('ai-config')
  @ApiOperation({ summary: 'Get AI provider config from daemon' })
  getAiConfig() {
    return this.systemService.getAiConfig();
  }

  @Put('ai-config')
  @ApiOperation({ summary: 'Update AI provider config on daemon' })
  setAiConfig(@Body() body: unknown) {
    return this.systemService.setAiConfig(body);
  }

  @Get('ai/models')
  @ApiOperation({ summary: 'List available Ollama models from daemon' })
  getOllamaModels() {
    return this.systemService.getOllamaModels();
  }

  @Post('ai/ollama/pull')
  @ApiOperation({ summary: 'Pull an Ollama model (NDJSON progress stream)' })
  async pullOllamaModel(@Body() body: { model?: string }, @Res() res: Response) {
    const model = (body?.model || '').trim();
    if (!model) {
      throw new HttpException('model name required', HttpStatus.BAD_REQUEST);
    }
    const upstream = await this.systemService.pullOllamaModel(model);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      throw new HttpException(text || `Ollama pull failed (${upstream.status})`, upstream.status || 502);
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/x-ndjson');
    res.setHeader('X-Accel-Buffering', 'no');
    const reader = upstream.body.getReader();
    const nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
            return;
          }
          this.push(Buffer.from(value));
        } catch (err) {
          this.destroy(err as Error);
        }
      },
    });
    nodeStream.pipe(res);
  }

  @Get('host-resources')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Host CPU / memory / disk metrics (admin only)' })
  getHostResources() {
    return this.hostResourcesService.getAll();
  }

  @Get('external-keys')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'External Portal key status (masked, admin only)' })
  getExternalKeys() {
    return this.externalKeys.getStatus();
  }

  @Post('external-keys/inbound/generate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Generate / rotate External Portal inbound API key' })
  generateInboundKey() {
    const key = this.externalKeys.generateInbound();
    return { key, ...this.externalKeys.getStatus() };
  }

  @Put('external-keys/outbound')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Save External Portal outbound (callback) API key' })
  setOutboundKey(@Body() body: { key?: string }) {
    return this.externalKeys.setOutbound(body?.key ?? '');
  }

  @Get('interpretation')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Classification source: portal pipeline or GVC' })
  getInterpretation() {
    return this.interpretation.get();
  }

  @Put('interpretation')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Switch classification between the portal and GVC' })
  setInterpretation(@Body() body: { source?: string }) {
    return this.interpretation.set(body?.source === 'gvc' ? 'gvc' : 'pipeline');
  }

  @Put('interpretation/connection')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Save the GVC partner URL and token' })
  setInterpretationConnection(@Body() body: { url?: string; token?: string }) {
    return this.interpretation.setConnection(body ?? {});
  }

  @Post('interpretation/token/generate')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Generate a GVC partner token to paste into GVC' })
  generateInterpretationToken() {
    const token = this.interpretation.generateToken();
    return { token, ...this.interpretation.get() };
  }

  @Post('interpretation/parity')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Compare portal and GVC classifications for one order' })
  interpretationParity(@Body() body: { orderId?: string }) {
    const orderId = body?.orderId?.trim();
    if (!orderId) throw new HttpException('orderId is required', HttpStatus.BAD_REQUEST);
    return this.gvc.parity(orderId);
  }

  @Put('interpretation/services')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Pin one service to the portal or to GVC after a matching comparison' })
  async setInterpretationService(@Body() body: { service?: string; source?: string; orderId?: string }) {
    const service = body?.service?.trim() ?? '';
    if (body?.source === 'default' || body?.source === '' || body?.source == null) {
      return this.interpretation.setService(service, null);
    }
    if (body.source === 'pipeline') return this.interpretation.setService(service, 'pipeline');
    if (body.source !== 'gvc') throw new HttpException('source must be pipeline, gvc, or default', HttpStatus.BAD_REQUEST);
    const orderId = body.orderId?.trim();
    if (!orderId) throw new HttpException('Compare an order of this service before using GVC', HttpStatus.BAD_REQUEST);
    const report = await this.gvc.parity(orderId);
    if (report.service !== service) {
      throw new HttpException('That order belongs to a different service', HttpStatus.BAD_REQUEST);
    }
    if (!report.agreed) throw new HttpException(report.message, HttpStatus.BAD_REQUEST);
    return this.interpretation.setService(service, 'gvc');
  }
}
