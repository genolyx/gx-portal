import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { OrdersModule } from '../orders/orders.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { GvcPartnerService } from './gvc-partner.service';
import { InterpretationSettingsService } from './interpretation-settings.service';

@Module({
  imports: [DaemonModule, OrdersModule],
  controllers: [ReviewController],
  providers: [ReviewService, GvcPartnerService, InterpretationSettingsService],
  exports: [InterpretationSettingsService, GvcPartnerService],
})
export class ReviewModule {}
