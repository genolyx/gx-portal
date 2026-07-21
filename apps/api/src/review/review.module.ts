import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [DaemonModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
