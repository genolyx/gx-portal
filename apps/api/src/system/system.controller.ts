import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { HostResourcesService } from './host-resources.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly hostResourcesService: HostResourcesService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Gx-portal + daemon health check' })
  async health() {
    const daemonHealth = await this.systemService.health().catch(() => ({ status: 'unreachable' }));
    return { portal: 'ok', daemon: daemonHealth };
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

  @Get('host-resources')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Host CPU / memory / disk metrics (admin only)' })
  getHostResources() {
    return this.hostResourcesService.getAll();
  }
}
