import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { HostResourcesService } from './host-resources.service';

@Module({
  imports: [DaemonModule],
  controllers: [SystemController],
  providers: [SystemService, HostResourcesService],
})
export class SystemModule {}
