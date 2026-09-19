import { Module } from '@nestjs/common';
import { ExternalModule } from '../external/external.module';
import { OrdersModule } from '../orders/orders.module';
import { GxBearerGuard } from './gx-auth.guard';
import { GxCallbacksService } from './gx-callbacks.service';
import { GxController } from './gx.controller';
import { GxService } from './gx.service';

@Module({
  imports: [OrdersModule, ExternalModule],
  controllers: [GxController],
  providers: [GxService, GxCallbacksService, GxBearerGuard],
  exports: [GxService],
})
export class GxModule {}
