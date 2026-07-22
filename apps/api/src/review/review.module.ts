import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { OrdersModule } from '../orders/orders.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [DaemonModule, OrdersModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
