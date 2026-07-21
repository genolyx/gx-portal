import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [DaemonModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
