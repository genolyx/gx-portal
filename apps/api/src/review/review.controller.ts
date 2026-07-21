import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ReviewService } from './review.service';
import type { ClassifyRequest, GeneKnowledge, VariantKnowledge } from '@gx-portal/types';

@ApiTags('review')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get(':orderId/result')
  @ApiOperation({ summary: 'Get analysis result' })
  getResult(@Param('orderId') orderId: string) {
    return this.reviewService.getResult(orderId);
  }

  @Post(':orderId/classify-variants')
  @ApiOperation({ summary: 'Classify variants via daemon' })
  classify(@Param('orderId') orderId: string, @Body() body: ClassifyRequest) {
    return this.reviewService.classifyVariants(orderId, body);
  }

  @Get(':orderId/coverage-context')
  @ApiOperation({ summary: 'Get BAM/coverage context for IGV' })
  coverageContext(@Param('orderId') orderId: string) {
    return this.reviewService.getCoverageContext(orderId);
  }

  @Get(':orderId/gene-coverage/:gene')
  @ApiOperation({ summary: 'Get per-gene coverage stats' })
  geneCoverage(@Param('orderId') orderId: string, @Param('gene') gene: string) {
    return this.reviewService.getGeneCoverage(orderId, gene);
  }

  @Get(':orderId/gene-knowledge')
  @ApiOperation({ summary: 'Get Gemini gene knowledge cache' })
  getGeneKnowledge(@Param('orderId') orderId: string) {
    return this.reviewService.getGeneKnowledge(orderId);
  }

  @Put(':orderId/gene-knowledge')
  @ApiOperation({ summary: 'Save gene knowledge edits' })
  putGeneKnowledge(@Param('orderId') orderId: string, @Body() body: GeneKnowledge[]) {
    return this.reviewService.putGeneKnowledge(orderId, body);
  }

  @Get(':orderId/variant-knowledge')
  @ApiOperation({ summary: 'Get variant knowledge notes' })
  getVariantKnowledge(@Param('orderId') orderId: string) {
    return this.reviewService.getVariantKnowledge(orderId);
  }

  @Put(':orderId/variant-knowledge')
  @ApiOperation({ summary: 'Save variant knowledge notes' })
  putVariantKnowledge(@Param('orderId') orderId: string, @Body() body: VariantKnowledge[]) {
    return this.reviewService.putVariantKnowledge(orderId, body);
  }

  @Post(':orderId/pgx-review')
  @ApiOperation({ summary: 'Save PGx reviewer confirmation' })
  savePgx(@Param('orderId') orderId: string, @Body() body: unknown) {
    return this.reviewService.savePgxReview(orderId, body);
  }

  @Post(':orderId/dark-genes-review')
  @ApiOperation({ summary: 'Save dark genes review' })
  saveDarkGenes(@Param('orderId') orderId: string, @Body() body: unknown) {
    return this.reviewService.saveDarkGenesReview(orderId, body);
  }

  @Get('variant-sets')
  @ApiOperation({ summary: 'Get variant tag sets' })
  getVariantSets() {
    return this.reviewService.getVariantSets();
  }
}
