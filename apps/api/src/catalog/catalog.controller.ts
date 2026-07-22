import {
  Controller, Get, Post, Delete, Body, Param, Query, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ── Variant Sets ────────────────────────────────────────────────────
  @Get('variant-sets')
  @ApiOperation({ summary: 'List all variant sets' })
  getVariantSets() {
    return this.catalogService.getVariantSets();
  }

  @Get('variant-sets/:id')
  @ApiOperation({ summary: 'Get entries of a specific variant set' })
  getVariantSetEntries(@Param('id') id: string) {
    return this.catalogService.getVariantSetEntries(id);
  }

  @Delete('variant-sets/:id')
  @ApiOperation({ summary: 'Delete a variant set' })
  deleteVariantSet(@Param('id') id: string) {
    return this.catalogService.deleteVariantSet(id);
  }

  // ── Panels ──────────────────────────────────────────────────────────
  @Get('panels')
  @ApiOperation({ summary: 'List all WES panel packages' })
  getPanels() {
    return this.catalogService.getPanels();
  }

  @Get('panels/:id')
  @ApiOperation({ summary: 'Get full panel data (including genes) by ID' })
  getPanel(@Param('id') id: string) {
    const panel = this.catalogService.getPanelById(id);
    if (!panel) throw new NotFoundException(`Panel '${id}' not found in custom catalog`);
    return panel;
  }

  @Post('panels')
  @ApiOperation({ summary: 'Create or update a WES panel package' })
  savePanel(@Body() body: unknown) {
    return this.catalogService.savePanel(body);
  }

  @Delete('panels/:id')
  @ApiOperation({ summary: 'Delete a custom WES panel package' })
  deletePanel(@Param('id') id: string) {
    return this.catalogService.deletePanel(id);
  }

  @Get('browse/fastq')
  @ApiOperation({ summary: 'Browse FASTQ files on daemon server' })
  browseFastq(
    @Query('path') path?: string,
    @Query('service_code') service_code?: string,
  ) {
    return this.catalogService.browseFastq(path ?? '', service_code ?? 'carrier_screening');
  }

  @Get('browse/bam-csv')
  @ApiOperation({ summary: 'Browse BAM/CSV files on daemon server' })
  browseBamCsv(
    @Query('path') path?: string,
    @Query('service_code') service_code?: string,
    @Query('abs_path') abs_path?: string,
    @Query('file_ext') file_ext?: string,
  ) {
    return this.catalogService.browseBamCsv({
      path: path ?? '',
      service_code: service_code ?? 'carrier_screening',
      abs_path,
      file_ext,
    });
  }

  // ── Literature ──────────────────────────────────────────────────────
  @Get('literature/stats')
  @ApiOperation({ summary: 'Literature cache statistics' })
  getLiteratureStats() {
    return this.catalogService.getLiteratureStats();
  }

  @Get('literature/articles')
  @ApiOperation({ summary: 'List cached literature articles' })
  getLiteratureArticles(
    @Query('page')     page?: string,
    @Query('per_page') per_page?: string,
    @Query('q')        q?: string,
    @Query('sort')     sort?: string,
  ) {
    return this.catalogService.getLiteratureArticles({
      page:     page ? parseInt(page, 10) : 1,
      per_page: per_page ? parseInt(per_page, 10) : 20,
      q,
      sort,
    });
  }

  @Get('literature/articles/:pmid')
  @ApiOperation({ summary: 'Get a cached literature article by PMID' })
  getLiteratureArticle(@Param('pmid') pmid: string) {
    return this.catalogService.getLiteratureArticle(pmid);
  }

  @Delete('literature/articles/:pmid')
  @ApiOperation({ summary: 'Remove a literature article from cache' })
  deleteLiteratureArticle(@Param('pmid') pmid: string) {
    return this.catalogService.deleteLiteratureArticle(pmid);
  }

  @Delete('literature/cache')
  @ApiOperation({ summary: 'Clear all literature cache' })
  clearLiteratureCache() {
    return this.catalogService.clearLiteratureCache();
  }

  @Get('literature/search')
  @ApiOperation({ summary: 'Search literature for a variant' })
  searchLiterature(
    @Query('gene')          gene?: string,
    @Query('hgvsc')         hgvsc?: string,
    @Query('hgvsp')         hgvsp?: string,
    @Query('force_refresh') force_refresh?: string,
  ) {
    return this.catalogService.searchLiterature({ gene, hgvsc, hgvsp, force_refresh: force_refresh === 'true' });
  }
}
