import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard, type ApiKeyRequest } from '../auth/guards/api-key.guard';
import type { RequestUser } from '../orders/order-registry.service';
import { ExternalCreateOrderDto } from './dto/external-create-order.dto';
import { ExternalOrdersService } from './external-orders.service';

@ApiTags('external-orders')
@ApiSecurity('api-key')
@ApiHeader({ name: 'X-API-Key', required: true, description: 'External portal API key' })
@UseGuards(ApiKeyGuard)
@Controller('external/orders')
export class ExternalOrdersController {
  constructor(private readonly externalOrders: ExternalOrdersService) {}

  private user(req: ApiKeyRequest): RequestUser {
    return req.user as RequestUser;
  }

  @Post(':orderId/start')
  @ApiOperation({ summary: 'Start a saved order pipeline (external portal)' })
  start(@Param('orderId') orderId: string, @Req() req: ApiKeyRequest) {
    return this.externalOrders.startOrder(orderId, this.user(req));
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get an order (external portal, client-scoped)' })
  get(@Param('orderId') orderId: string, @Req() req: ApiKeyRequest) {
    return this.externalOrders.getOrder(orderId, this.user(req));
  }

  @Post(':serviceCode')
  @ApiOperation({ summary: 'Create an order (external portal)' })
  create(
    @Param('serviceCode') serviceCode: string,
    @Body() body: ExternalCreateOrderDto,
    @Req() req: ApiKeyRequest,
  ) {
    return this.externalOrders.create(serviceCode, body, this.user(req));
  }
}
