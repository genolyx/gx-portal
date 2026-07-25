import { Controller, Get, Put, Post, Body, Query, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'stream';
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
}
