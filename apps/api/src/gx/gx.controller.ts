import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../orders/order-registry.service';
import { GxCreateOrderDto } from './dto/gx-create-order.dto';
import { GxBearerGuard, type GxApiRequest } from './gx-auth.guard';
import { GxService } from './gx.service';

@ApiTags('gx-v1')
@Controller('v1')
export class GxController {
  constructor(private readonly gx: GxService) {}

  @Get('order-schema')
  @UseGuards(GxBearerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'GX order field schema (Create Order fields)' })
  orderSchema(@Query('service_code') serviceCode: string) {
    return this.gx.getSchema(serviceCode);
  }

  @Post('orders')
  @UseGuards(GxBearerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create GX order (accepted immediately; FASTQ downloaded in background)' })
  create(@Body() body: GxCreateOrderDto, @Req() req: GxApiRequest) {
    return this.gx.createOrder(body, req.user as RequestUser);
  }

  @Post('orders/:orderId/send-report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send latest Report_*.pdf to GX callback.report_url' })
  sendReport(@Param('orderId') orderId: string, @Req() req: GxApiRequest) {
    return this.gx.sendReport(orderId, req.user as RequestUser);
  }
}
