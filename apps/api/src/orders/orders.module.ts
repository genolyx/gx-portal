import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRegistryService } from './order-registry.service';

@Module({
  imports: [DaemonModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRegistryService],
  exports: [OrdersService, OrderRegistryService],
})
export class OrdersModule {}
