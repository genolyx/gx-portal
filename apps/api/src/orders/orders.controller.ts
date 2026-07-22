import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  Req,
  Headers,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService, OrderListQuery } from './orders.service';
import type { OrderCreateBody } from '@gx-portal/types';
import type { RequestUser } from './order-registry.service';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private user(req: Request): RequestUser {
    return req.user as RequestUser;
  }

  @Get()
  @ApiOperation({ summary: 'List orders (client-scoped for non-admin users)' })
  list(@Query() query: OrderListQuery, @Req() req: Request) {
    return this.ordersService.listOrders(query, this.user(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order' })
  getOne(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getOrder(id, this.user(req));
  }

  @Post(':serviceCode/save')
  @ApiOperation({ summary: 'Create/save order draft (order ID auto-generated)' })
  create(
    @Param('serviceCode') serviceCode: string,
    @Body() body: OrderCreateBody,
    @Req() req: Request,
  ) {
    return this.ordersService.createOrder(serviceCode, body, this.user(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order draft' })
  update(
    @Param('id') id: string,
    @Body() body: Partial<OrderCreateBody>,
    @Req() req: Request,
  ) {
    return this.ordersService.updateOrder(id, body, this.user(req));
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start pipeline' })
  start(
    @Param('id') id: string,
    @Body() options: { fresh?: boolean; force?: boolean },
    @Req() req: Request,
  ) {
    return this.ordersService.startOrder(id, options, this.user(req));
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop pipeline' })
  stop(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.stopOrder(id, this.user(req));
  }

  @Post(':id/reprocess-results')
  @ApiOperation({ summary: 'Reprocess analysis results' })
  reprocess(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.reprocessResults(id, this.user(req));
  }

  @Post(':id/delete-run')
  @ApiOperation({ summary: 'Delete run artifacts' })
  deleteRun(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.deleteRun(id, this.user(req));
  }

  @Post(':id/purge-db')
  @ApiOperation({ summary: 'Purge order from DB' })
  purgeDb(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.purgeDb(id, this.user(req));
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'List order output files' })
  getFiles(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getFiles(id, this.user(req));
  }

  @Get(':id/pipeline-log')
  @ApiOperation({ summary: 'Get pipeline log' })
  getLog(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getPipelineLog(id, this.user(req));
  }

  @Get(':id/bam-context')
  @ApiOperation({ summary: 'Discover BAM/CRAM file in order output directory for IGV' })
  getBamContext(@Param('id') id: string, @Req() req: Request) {
    return this.ordersService.getBamContext(id, this.user(req));
  }

  @Get(':id/output/:filename')
  @ApiOperation({ summary: 'Download / stream output file (supports HTTP Range for BAM)' })
  async downloadFile(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
  ) {
    const { filePath, mimeType } = await this.ordersService.getOutputFile(id, filename, this.user(req));
    const stat = statSync(filePath);
    const total = stat.size;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : total - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range',  `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(chunkSize));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', String(total));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      createReadStream(filePath).pipe(res);
    }
  }

  @Post('analysis/:serviceCode/:id/submit')
  @ApiOperation({ summary: 'Submit to Platform' })
  submitToPlatform(
    @Param('serviceCode') serviceCode: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ordersService.submitToPlatform(serviceCode, id, body, this.user(req));
  }
}
