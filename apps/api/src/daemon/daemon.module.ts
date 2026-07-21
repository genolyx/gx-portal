import { Module } from '@nestjs/common';
import { DaemonService } from './daemon.service';

@Module({
  providers: [DaemonService],
  exports: [DaemonService],
})
export class DaemonModule {}
