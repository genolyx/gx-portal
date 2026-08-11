import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ExternalOrdersController } from './external-orders.controller';
import { ExternalOrdersService } from './external-orders.service';
import { FastqDownloadService } from './fastq-download.service';

@Module({
  imports: [OrdersModule],
  controllers: [ExternalOrdersController],
  providers: [ExternalOrdersService, FastqDownloadService, ApiKeyGuard],
})
export class ExternalModule {}
