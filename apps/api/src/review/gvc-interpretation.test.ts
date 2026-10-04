import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReviewData, Variant } from '@gx-portal/types';
import {
  applyGvcClassifications,
  applyGvcDarkGenes,
  applyGvcPgx,
  classificationParity,
  curationEvidence,
  configuredInterpretationSource,
  interpretationServiceKey,
  partnerVariantKey,
  sourceForService,
  isFullWesReview,
  partnerJobRequest,
  resolveInterpretationSource,
  variantsFromGvcSummaries,
  classificationProgressMessage,
  waitForPartnerJob,
  variantLocusKey,
} from './gvc-interpretation';

describe('interpretation source', () => {
  it('stays on the pipeline unless gvc is set', () => {
    assert.equal(configuredInterpretationSource(undefined), 'pipeline');
    assert.equal(configuredInterpretationSource('pipeline'), 'pipeline');
    assert.equal(configuredInterpretationSource('GVC'), 'gvc');
    assert.equal(resolveInterpretationSource(null, undefined), 'pipeline');
    assert.equal(resolveInterpretationSource('pipeline', 'gvc'), 'pipeline');
    assert.equal(resolveInterpretationSource(null, 'gvc'), 'gvc');
  });
});

describe('per-service source', () => {
  it('sends health screening to GVC and keeps sgNIPT on the portal', () => {
    assert.equal(interpretationServiceKey({ order_id: '1', service_code: 'health_screening', variants: [] }), 'health_screening');
    assert.equal(interpretationServiceKey({ order_id: '1', service_code: 'sgnipt', variants: [] }), null);
    assert.equal(interpretationServiceKey({
      order_id: '1',
      service_code: 'whole_exome',
      filter_summary: { panel_category: 'hereditary_cancer' },
      variants: [],
    }), 'hereditary_cancer');
    assert.equal(sourceForService('pipeline', {}, null), 'pipeline');
    assert.equal(sourceForService('gvc', {}, 'whole_exome'), 'gvc');
    assert.equal(sourceForService('pipeline', { carrier_screening: 'gvc' }, 'carrier_screening'), 'gvc');
    assert.equal(sourceForService('gvc', { whole_exome: 'pipeline' }, 'whole_exome'), 'pipeline');
  });

  it('adopts GVC only when overlapping labels match', () => {
    const variants = [
      { variant_id: '1', chrom: '7', pos: 100, ref: 'A', alt: 'T', acmg_classification: 'Likely pathogenic' },
      { variant_id: '2', chrom: '12', pos: 200, ref: 'G', alt: 'C', acmg_classification: 'Benign' },
    ] as Variant[];
    const agreed = classificationParity(variants, [
      { chrom: 'chr7', pos: 100, ref: 'A', alt: 'T', acmgClassification: 'Likely_pathogenic', acmgCriteria: [], heldReason: null },
      { chrom: '12', pos: 200, ref: 'G', alt: 'C', acmgClassification: null, acmgCriteria: [], heldReason: 'vus' },
    ]);
    assert.equal(agreed.agreed, true);
    assert.equal(agreed.matched, 1);
    assert.equal(agreed.held, 1);
    const differ = classificationParity(variants, [
      { chrom: '7', pos: 100, ref: 'A', alt: 'T', acmgClassification: 'Benign', acmgCriteria: [], heldReason: null },
    ]);
    assert.equal(differ.agreed, false);
    assert.equal(differ.examples[0].pipeline, 'Likely pathogenic');
    assert.equal(differ.examples[0].gvc, 'Benign');
  });
});

describe('classification progress', () => {
  it('says how many variants are classified while workers are still running', () => {
    assert.equal(
      classificationProgressMessage({
        classification: { queued: 194, running: 4, succeeded: 2, failed: 0 },
        counts: { kept: 511, held: 91 },
      }),
      'Classification in progress. 2 of 200 classified, 4 running.',
    );
  });

  it('says the order is queued while no worker has claimed it', () => {
    assert.equal(
      classificationProgressMessage({
        status: 'running',
        classification: { queued: 200, running: 0, succeeded: 0, failed: 0 },
      }),
      'Classification is queued. 0 of 200 classified, 200 waiting.',
    );
  });
});

describe('partner job wait', () => {
  it('returns the job once workers finish', async () => {
    const seen = ['running', 'succeeded'];
    const job = await waitForPartnerJob({ status: 'queued' }, async () => ({ status: seen.shift() ?? 'succeeded' }), {
      timeoutMs: 1000,
      intervalMs: 1,
      sleep: async () => undefined,
      now: () => 0,
    });
    assert.equal(job.status, 'succeeded');
  });

  it('returns a whole-exome job without waiting for the workers', async () => {
    let reads = 0;
    const job = await waitForPartnerJob({ status: 'running' }, async () => {
      reads += 1;
      return { status: 'running' };
    }, {
      timeoutMs: 0,
      intervalMs: 1,
      sleep: async () => undefined,
      now: () => 0,
    });
    assert.equal(job.status, 'running');
    assert.equal(reads, 0);
  });

  it('stops when the wait budget ends', async () => {
    let clock = 0;
    const job = await waitForPartnerJob({ status: 'running' }, async () => ({ status: 'running' }), {
      timeoutMs: 5,
      intervalMs: 1,
      sleep: async () => { clock += 5; },
      now: () => clock,
    });
    assert.equal(job.status, 'running');
  });
});

describe('partner job request', () => {
  it('sends the panel gene list and allele frequency', () => {
    const review = {
      order_id: 'CSGX26070001',
      service_code: 'carrier_screening',
      interpretation_genes: ['CFTR', 'PAH'],
      order_params: { package_code: 'CarrierScreening', max_af: '0.001' },
      variants: [],
    } as ReviewData;
    const request = partnerJobRequest('CSGX26070001', review, {
      sha256: 'a'.repeat(64),
      uri: 'daemon://CSGX26070001/annotated.vcf.gz',
    });
    assert.equal(request.ok, true);
    if (request.ok) {
      assert.equal(request.body.serviceCode, 'carrier_screening');
      assert.equal(request.body.genes, 'CFTR,PAH');
      assert.equal(request.body.maxAf, 0.001);
      assert.equal(request.body.referenceBuild, 'GRCh38');
      assert.equal(request.body.includePgx, true);
      assert.equal(request.body.includeApoePgx, false);
    }
  });

  it('sends the GVC quality limits and leaves a blank depth off the request', () => {
    const review = {
      order_id: 'CSGX26070001',
      service_code: 'carrier_screening',
      interpretation_genes: ['CFTR'],
      order_params: { min_qual: '30', min_gq: 20, min_depth: '20', pass_only: false },
      variants: [],
    } as ReviewData;
    const request = partnerJobRequest('CSGX26070001', review, {
      sha256: 'a'.repeat(64),
      uri: 'daemon://CSGX26070001/annotated.vcf.gz',
    });
    assert.equal(request.ok, true);
    if (request.ok) {
      assert.equal(request.body.minQual, 30);
      assert.equal(request.body.minGenotypeQuality, 20);
      assert.equal(request.body.minDepth, 20);
      assert.equal(request.body.passOnly, false);
    }
    const open = partnerJobRequest('CSGX26070001', {
      ...review,
      order_params: { pass_only: true },
    } as ReviewData, {
      sha256: 'a'.repeat(64),
      uri: 'daemon://CSGX26070001/annotated.vcf.gz',
    });
    assert.equal(open.ok, true);
    if (open.ok) {
      assert.equal(open.body.minDepth, undefined);
      assert.equal(open.body.passOnly, undefined);
    }
  });

  it('sends the PGx flags and adds APOE when that box is checked', () => {
    const review = {
      order_id: 'HSGX26070001',
      service_code: 'health_screening',
      interpretation_genes: ['CFTR'],
      order_params: { include_pgx: false, include_apoe_pgx: true },
      variants: [],
    } as ReviewData;
    const request = partnerJobRequest('HSGX26070001', review, {
      sha256: 'b'.repeat(64),
      uri: 'daemon://HSGX26070001/annotated.vcf.gz',
    });
    assert.equal(request.ok, true);
    if (request.ok) {
      assert.equal(request.body.includePgx, false);
      assert.equal(request.body.includeApoePgx, true);
      assert.equal(request.body.genes, 'CFTR,APOE');
    }
  });

  it('sends a whole-exome vcf-only order without a gene list', () => {
    const review = {
      order_id: 'WEGX26070002',
      service_code: 'whole_exome',
      order_params: { wes_panel_id: 'full_wes', include_pgx: false },
      variants: [],
    } as ReviewData;
    assert.equal(isFullWesReview(review), true);
    const request = partnerJobRequest('WEGX26070002', review, {
      sha256: 'c'.repeat(64),
      uri: 'daemon://WEGX26070002/annotated.vcf.gz',
    });
    assert.equal(request.ok, true);
    if (request.ok) {
      assert.equal(request.body.wesPanelId, 'full_wes');
      assert.equal(request.body.panelCode, 'carrier-2000');
      assert.equal(request.body.genes, '');
      assert.equal(request.body.includePgx, false);
      assert.equal(request.body.frequencyTrack, undefined);
    }
    const chosen = {
      ...review,
      order_params: {
        wes_panel_id: 'full_wes',
        gvc_panel_code: 'carrier-2000',
        gvc_frequency_track: 'carrier',
      },
    } as ReviewData;
    const chosenRequest = partnerJobRequest('WEGX26070002', chosen, {
      sha256: 'c'.repeat(64),
      uri: 'daemon://WEGX26070002/annotated.vcf.gz',
    });
    assert.equal(chosenRequest.ok, true);
    if (chosenRequest.ok) {
      assert.equal(chosenRequest.body.panelCode, 'carrier-2000');
      assert.equal(chosenRequest.body.frequencyTrack, 'carrier');
    }
    const rows = variantsFromGvcSummaries([
      { chrom: '7', pos: 10, ref: 'A', alt: 'T', gene: 'CFTR', acmgClassification: 'Pathogenic', acmgCriteria: ['PVS1'], heldReason: null },
    ], '1.0');
    assert.equal(rows[0]?.gene, 'CFTR');
    assert.equal(rows[0]?.acmg_classification, 'Pathogenic');
  });

  it('does not call GVC when the order has no gene list or HPO', () => {
    const review = {
      order_id: 'WEGX26070001',
      service_code: 'whole_exome',
      variants: [],
    } as ReviewData;
    assert.deepEqual(partnerJobRequest('WEGX26070001', review, { sha256: 'a'.repeat(64), uri: 'x' }), {
      ok: false,
      reason: 'gene_scope_required',
    });
  });
});

describe('GVC PGx scope', () => {
  it('hides the pipeline PGx table when GVC leaves PGx out', () => {
    const scoped = applyGvcPgx({
      gene_results: [{ gene: 'CYP2C19' }],
      custom_gene_results: [{ gene: 'APOE' }],
    }, { includePgx: false, includeApoePgx: true });
    assert.equal(scoped.note, 'PGx left out by GVC');
    assert.deepEqual(scoped.pgx?.gene_results, []);
    assert.deepEqual(scoped.pgx?.custom_gene_results, []);
  });

  it('drops APOE and keeps a reviewer choice already saved on the order', () => {
    const scoped = applyGvcPgx({
      gene_results: [{ gene: 'CYP2C19' }, { gene: 'APOE' }],
      portal_review: { include_apoe_proactive_pdf: true },
    }, { includePgx: true, includeApoePgx: false });
    assert.deepEqual(scoped.pgx?.gene_results?.map((row) => row.gene), ['CYP2C19']);
    assert.equal(scoped.pgx?.portal_review?.include_apoe_proactive_pdf, true);
  });
});

describe('GVC classification overlay', () => {
  it('matches chr prefixes and leaves held variants on the pipeline label', () => {
    const variants = [
      { variant_id: '1', gene: 'CFTR', chrom: 'chr7', pos: 117559590, ref: 'A', alt: 'T', acmg_classification: 'Uncertain_significance' },
      { variant_id: '2', gene: 'PAH', chrom: '12', pos: 103234, ref: 'G', alt: 'C', acmg_classification: 'Benign' },
    ] as Variant[];
    const applied = applyGvcClassifications(variants, [
      {
        chrom: '7',
        pos: 117559590,
        ref: 'a',
        alt: 't',
        acmgClassification: 'Pathogenic',
        acmgCriteria: ['PVS1', 'PM2'],
        heldReason: null,
      },
      {
        chrom: '12',
        pos: 103234,
        ref: 'G',
        alt: 'C',
        acmgClassification: 'Likely_pathogenic',
        acmgCriteria: ['PP3'],
        heldReason: 'vus',
      },
      {
        chrom: '1',
        pos: 155235843,
        ref: 'A',
        alt: 'G',
        gene: 'GBA',
        hgvsc: 'c.1226A>G',
        acmgClassification: null,
        acmgCriteria: [],
        heldReason: 'benign',
      },
    ], '1.0');
    assert.equal(applied.matched, 1);
    assert.equal(applied.held, 2);
    assert.equal(applied.variants[0].acmg_classification, 'Pathogenic');
    assert.deepEqual(applied.variants[0].acmg_criteria, ['PVS1', 'PM2']);
    assert.equal(applied.variants[1].acmg_classification, 'Benign');
    assert.equal(applied.variants[1].gvc_held_reason, 'vus');
    assert.equal(applied.variants[2].gene, 'GBA');
    assert.equal(applied.variants[2].gvc_held_reason, 'benign');
    assert.equal(applied.variants[2].hgvsc, 'c.1226A>G');
    assert.equal(variantLocusKey(applied.variants[0]), '7:117559590:A:T');
  });
});

describe('GVC curation evidence', () => {
  it('keeps criterion rationale and PMIDs, and drops engine markup', () => {
    assert.equal(partnerVariantKey('GRCh38', { chrom: 'chr7', pos: 117559590, ref: 'a', alt: 't' }), 'GRCh38:7:117559590:A:T');
    const evidence = curationEvidence({
      contractVersion: '1.0',
      variant: { chromosome: 'chr7', start: 117559590, referenceAllele: 'A', alternateAllele: 'T' },
      acmg: {
        classification: { label: 'Pathogenic' },
        criteria: [{ code: 'PVS1', strength: 'very_strong', direction: 'pathogenic', rationale: 'Null variant. <b>NMD</b> expected.' }],
      },
      scores: { gnomadAf: 0.00001, caddPhred: 32, revelScore: null },
      highlights: { clinvarSignificance: 'Pathogenic', hgmdMatch: 'DM', literatureStatus: 'ok' },
      engine: {
        literature: { status: 'ok', clinical_summary: '<p>Reported in patients.</p>', local_index: { pmids: ['123', 'nope'] } },
        parsedData: { hgmd_excel_pmids: ['123', '456'] },
      },
    }, { chrom: '7', pos: 117559590, ref: 'A', alt: 'T' });
    assert.equal(evidence.available, true);
    assert.equal(evidence.criteria[0].rationale, 'Null variant. NMD expected.');
    assert.deepEqual(evidence.pmids, ['123', '456']);
    assert.equal(evidence.clinicalSummary, 'Reported in patients.');
    assert.equal(curationEvidence({ contractVersion: '1.0' }, { chrom: '7', pos: 1, ref: 'A', alt: 'T' }).reason, 'unavailable');
  });
});

describe('GVC dark genes', () => {
  it('replaces sections and keeps reviewer approvals', () => {
    const next = applyGvcDarkGenes(
      {
        summary_text: 'pipeline',
        detailed_text: 'SMAca CHECK:\n  SMN1_CN=1\n',
        detailed_sections: [{ title: 'Old', body: 'pipeline', kind: 'normal' }],
        section_reviews: [{ approved: true, notes: 'keep' }],
      },
      {
        status: 'ready',
        detailed_sections: [{ title: 'SMAca CHECK', body: 'SMN1_CN=1', kind: 'warning' }],
        cftr_ivs9_eh: { risk_level: 'low', display_t: '7T/7T' },
      },
    );
    assert.equal(next?.summary_text, 'pipeline');
    assert.equal(next?.detailed_sections?.[0]?.kind, 'warning');
    assert.equal(next?.section_reviews?.[0]?.notes, 'keep');
    assert.equal(
      applyGvcDarkGenes({ summary_text: 'pipeline' }, { status: 'deferred', detailed_sections: [] })?.summary_text,
      'pipeline',
    );
  });
});
