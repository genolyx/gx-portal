import {
  Controller,
  Get,
  Head,
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
import { Readable } from 'stream';
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
  @ApiOperation({ summary: 'Stream BAM file for IGV (local path or daemon file proxy)' })
  async streamBam(
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
  ) {
    const ctx = await this.reviewService.getCoverageContext(orderId, this.user(req));
    if (ctx.bam_path) {
      return this._streamFile(res, ctx.bam_path, ctx.bam_label ?? 'alignment.bam', rangeHeader);
    }
    if (ctx.bam_rel_path) {
      return this._proxyDaemonFile(orderId, ctx.bam_rel_path, req, res, 'GET');
    }
    res.status(404).json({ message: 'No BAM file found for this order' });
  }

  @Get(':orderId/bai')
  @ApiOperation({ summary: 'Stream BAM index (.bai) for IGV' })
  async streamBai(
    @Param('orderId') orderId: string,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('range') rangeHeader?: string,
  ) {
    const ctx = await this.reviewService.getCoverageContext(orderId, this.user(req));
    if (ctx.bam_index_path) {
      return this._streamFile(
        res,
        ctx.bam_index_path,
        (ctx.bam_label ?? 'alignment.bam') + '.bai',
        rangeHeader,
      );
    }
    if (ctx.bam_index_rel_path) {
      return this._proxyDaemonFile(orderId, ctx.bam_index_rel_path, req, res, 'GET');
    }
    res.status(404).json({ message: 'BAI index not found' });
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

  @Head(':orderId/file/*')
  @ApiOperation({ summary: 'HEAD probe for IGV byte-range clients' })
  async headArtifact(
    @Param('orderId') orderId: string,
    @Param('0') filePath: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this._proxyDaemonFile(orderId, String(filePath || ''), req, res, 'HEAD');
  }

  @Get(':orderId/file/*')
  @ApiOperation({ summary: 'Stream order analysis artifact (BAM/BAI Range, IGV HTML, SVGs)' })
  async getArtifact(
    @Param('orderId') orderId: string,
    @Param('0') filePath: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this._proxyDaemonFile(orderId, String(filePath || ''), req, res, 'GET');
  }

  /** Proxy daemon `/order/{id}/file/...` with Range / Accept-Ranges for IGV.js. */
  private async _proxyDaemonFile(
    orderId: string,
    rel: string,
    req: Request,
    res: Response,
    method: 'GET' | 'HEAD',
  ) {
    try {
      const upstream = await this.reviewService.streamOrderArtifact(
        orderId,
        rel,
        { method, range: req.headers.range },
        this.user(req),
      );

      res.status(upstream.status);
      const pass = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'pragma',
      ];
      for (const h of pass) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Range, Accept-Ranges, Content-Length',
      );

      if (method === 'HEAD' || !upstream.body) {
        res.end();
        return;
      }

      // Node 18+: pipe Web ReadableStream → Express
      const nodeStream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
      nodeStream.pipe(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Artifact not found';
      if (!res.headersSent) res.status(404).json({ message: msg });
    }
  }
}
