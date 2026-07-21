import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DaemonModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
