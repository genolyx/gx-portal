import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OrdersService, OrderListQuery } from './orders.service';
import type { OrderCreateBody } from '@gx-portal/types';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders (proxies gx-daemon GET /orders)' })
  list(@Query() query: OrderListQuery) {
    return this.ordersService.listOrders(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order' })
  getOne(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Post(':serviceCode/save')
  @ApiOperation({ summary: 'Create/save order draft' })
  create(
    @Param('serviceCode') serviceCode: string,
    @Body() body: OrderCreateBody,
  ) {
    return this.ordersService.createOrder(serviceCode, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order draft' })
  update(@Param('id') id: string, @Body() body: Partial<OrderCreateBody>) {
    return this.ordersService.updateOrder(id, body);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start pipeline' })
  start(
    @Param('id') id: string,
    @Body() options: { fresh?: boolean; force?: boolean },
  ) {
    return this.ordersService.startOrder(id, options);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop pipeline' })
  stop(@Param('id') id: string) {
    return this.ordersService.stopOrder(id);
  }

  @Post(':id/reprocess-results')
  @ApiOperation({ summary: 'Reprocess analysis results' })
  reprocess(@Param('id') id: string) {
    return this.ordersService.reprocessResults(id);
  }

  @Post(':id/delete-run')
  @ApiOperation({ summary: 'Delete run artifacts' })
  deleteRun(@Param('id') id: string) {
    return this.ordersService.deleteRun(id);
  }

  @Post(':id/purge-db')
  @ApiOperation({ summary: 'Purge order from DB' })
  purgeDb(@Param('id') id: string) {
    return this.ordersService.purgeDb(id);
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'List order output files' })
  getFiles(@Param('id') id: string) {
    return this.ordersService.getFiles(id);
  }

  @Get(':id/pipeline-log')
  @ApiOperation({ summary: 'Get pipeline log' })
  getLog(@Param('id') id: string) {
    return this.ordersService.getPipelineLog(id);
  }

  @Post('analysis/:serviceCode/:id/submit')
  @ApiOperation({ summary: 'Submit to Platform' })
  submitToPlatform(
    @Param('serviceCode') serviceCode: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.ordersService.submitToPlatform(serviceCode, id, body);
  }
}
