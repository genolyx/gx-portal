import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

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

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard bucket stats' })
  dashboard() {
    return this.systemService.dashboardBucket();
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
  log() {
    return this.systemService.daemonLog();
  }
}
