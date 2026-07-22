import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Res,
  Req,
  Headers,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReadStream, statSync } from 'fs';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewService } from './review.service';
import type { ClassifyRequest, GeneKnowledge, VariantKnowledge } from '@gx-portal/types';
import type { RequestUser } from '../orders/order-registry.service';

@ApiTags('review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private user(req: Request): RequestUser {
    return req.user as RequestUser;
  }

  @Get(':orderId/result')
  @ApiOperation({ summary: 'Get analysis result' })
  getResult(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.reviewService.getResult(orderId, this.user(req));
  }

  @Post(':orderId/classify-variants')
  @ApiOperation({ summary: 'Classify variants via daemon' })
  classify(@Param('orderId') orderId: string, @Body() body: ClassifyRequest, @Req() req: Request) {
    return this.reviewService.classifyVariants(orderId, body, this.user(req));
  }

  @Get(':orderId/coverage-context')
  @ApiOperation({ summary: 'Get BAM/coverage context for IGV' })
  coverageContext(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.reviewService.getCoverageContext(orderId, this.user(req));
  }

  @Get(':orderId/bam')
  @ApiOperation({ summary: 'Stream BAM file for IGV' })
  async streamBam(
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
  ) {
    const { bamPath, label } = await this.reviewService.getBamFilePath(orderId, this.user(req));
    return this._streamFile(res, bamPath, label ?? 'alignment.bam', rangeHeader);
  }

  @Get(':orderId/bai')
  @ApiOperation({ summary: 'Stream BAM index (.bai) file for IGV' })
  async streamBai(
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
  ) {
    const { baiPath, label } = await this.reviewService.getBamFilePath(orderId, this.user(req));
    if (!baiPath) { res.status(404).json({ message: 'BAI index not found' }); return; }
    return this._streamFile(res, baiPath, (label ?? 'alignment.bam') + '.bai', rangeHeader);
  }

  private _streamFile(res: Response, filePath: string, filename: string, rangeHeader?: string) {
    const stat = statSync(filePath);
    const total = stat.size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : total - 1;
      res.status(206);
      res.setHeader('Content-Range',  `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', String(total));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      createReadStream(filePath).pipe(res);
    }
  }

  @Get(':orderId/gene-coverage/:gene')
  @ApiOperation({ summary: 'Get per-gene coverage stats' })
  geneCoverage(@Param('orderId') orderId: string, @Param('gene') gene: string, @Req() req: Request) {
    return this.reviewService.getGeneCoverage(orderId, gene, this.user(req));
  }

  @Get(':orderId/gene-knowledge')
  @ApiOperation({ summary: 'Get Gemini gene knowledge cache' })
  getGeneKnowledge(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.reviewService.getGeneKnowledge(orderId, this.user(req));
  }

  @Put(':orderId/gene-knowledge')
  @ApiOperation({ summary: 'Save gene knowledge edits' })
  putGeneKnowledge(@Param('orderId') orderId: string, @Body() body: GeneKnowledge[], @Req() req: Request) {
    return this.reviewService.putGeneKnowledge(orderId, body, this.user(req));
  }

  @Get(':orderId/variant-knowledge')
  @ApiOperation({ summary: 'Get variant knowledge notes' })
  getVariantKnowledge(@Param('orderId') orderId: string, @Req() req: Request) {
    return this.reviewService.getVariantKnowledge(orderId, this.user(req));
  }

  @Put(':orderId/variant-knowledge')
  @ApiOperation({ summary: 'Save variant knowledge notes' })
  putVariantKnowledge(@Param('orderId') orderId: string, @Body() body: VariantKnowledge[], @Req() req: Request) {
    return this.reviewService.putVariantKnowledge(orderId, body, this.user(req));
  }

  @Post(':orderId/pgx-review')
  @ApiOperation({ summary: 'Save PGx reviewer confirmation' })
  savePgx(@Param('orderId') orderId: string, @Body() body: unknown, @Req() req: Request) {
    return this.reviewService.savePgxReview(orderId, body, this.user(req));
  }

  @Post(':orderId/dark-genes-review')
  @ApiOperation({ summary: 'Save dark genes review' })
  saveDarkGenes(@Param('orderId') orderId: string, @Body() body: unknown, @Req() req: Request) {
    return this.reviewService.saveDarkGenesReview(orderId, body, this.user(req));
  }

  @Get('variant-sets')
  @ApiOperation({ summary: 'Get variant tag sets' })
  getVariantSets() {
    return this.reviewService.getVariantSets();
  }
}
