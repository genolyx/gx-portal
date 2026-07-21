import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ReportService } from './report.service';
import type { ReportBody } from '@gx-portal/types';

@ApiTags('report')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post(':orderId/generate')
  @ApiOperation({ summary: 'Generate final report PDF' })
  generate(@Param('orderId') orderId: string, @Body() body: ReportBody) {
    return this.reportService.generateReport(orderId, body);
  }

  @Post(':orderId/preview')
  @ApiOperation({ summary: 'Preview report as HTML' })
  preview(@Param('orderId') orderId: string, @Body() body: ReportBody) {
    return this.reportService.previewReport(orderId, body);
  }

  @Post(':orderId/from-html')
  @ApiOperation({ summary: 'Generate report from edited HTML' })
  fromHtml(@Param('orderId') orderId: string, @Body() body: { html: string }) {
    return this.reportService.reportFromHtml(orderId, body);
  }
}
