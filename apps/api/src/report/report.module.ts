import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [DaemonModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
