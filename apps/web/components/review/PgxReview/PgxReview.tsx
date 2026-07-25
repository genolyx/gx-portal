'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Save } from 'lucide-react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import { Button, Card, Chip } from '@heroui/react';
import { LabeledCheckbox } from '../../ui/LabeledCheckbox';

interface PgxGene {
  gene: string;
  guideline_source?: string;
  diplotype?: string;
  phenotype?: string;
  activity_score?: number | string;
  allele1_function?: string;
  allele2_function?: string;
  call_source?: string;
  category?: string;
  reviewer_confirmed?: boolean;
  reviewer_comment?: string;
  recommendations?: string[];
  [key: string]: unknown;
}

const PHENOTYPE_COLOR: Record<string, 'danger' | 'warning' | 'default' | 'success' | 'accent'> = {
  'Poor Metabolizer':         'danger',
  'Ultrarapid Metabolizer':   'danger',
  'Intermediate Metabolizer': 'warning',
  'Normal Metabolizer':       'success',
  'Rapid Metabolizer':        'warning',
};

function phenotypeColor(phenotype?: string): 'danger' | 'warning' | 'default' | 'success' | 'accent' {
  if (!phenotype) return 'default';
  return PHENOTYPE_COLOR[phenotype] ?? 'accent';
}

export function PgxReview({ orderId }: { orderId: string }) {
  const { reviewData, setReviewData } = useReviewStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const pgx = reviewData?.pgx;

  if (!pgx) {
    return <p className="py-8 text-center text-muted">No PGx data available for this order.</p>;
  }

  const geneResults: PgxGene[]        = (pgx.gene_results ?? []) as PgxGene[];
  const customResults: PgxGene[]      = (pgx.custom_gene_results ?? []) as PgxGene[];
  const allPharmcatGenes: PgxGene[]   = (pgx.all_pharmcat_genes ?? []) as PgxGene[];
  const apoe = pgx.apoe_diplotype_for_report as { report_key?: string; source?: string } | undefined;

  const actionable  = geneResults.filter((g) => g.category === 'actionable');
  const informative = geneResults.filter((g) => g.category !== 'actionable');

  const toggleConfirm = (gene: string, confirmed: boolean) => {
    if (!reviewData || !reviewData.pgx) return;
    const updateGenes = (list: PgxGene[]) =>
      list.map((g) => g.gene === gene ? { ...g, reviewer_confirmed: confirmed } : g);
    setReviewData({
      ...reviewData,
      pgx: {
        ...reviewData.pgx,
        gene_results:        updateGenes(geneResults) as typeof reviewData.pgx.gene_results,
        custom_gene_results: updateGenes(customResults) as typeof reviewData.pgx.custom_gene_results,
      },
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await reviewApi.savePgx(orderId, pgx);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">PGx Pharmacogenomics Review</h3>
        <div className="flex flex-wrap items-center gap-2">
          {apoe && (
            <span className="text-xs text-muted">
              APOE: <strong className="text-foreground">{apoe.report_key ?? '—'}</strong>
              {apoe.source && <span> ({apoe.source})</span>}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowSummary((s) => !s)}
            className="gap-1.5"
          >
            {showSummary
              ? <EyeOff size={14} strokeWidth={2} aria-hidden />
              : <Eye size={14} strokeWidth={2} aria-hidden />}
            {showSummary ? 'Hide' : 'Show'} summary text
          </Button>
          <Button
            variant="primary"
            size="sm"
            isDisabled={saving}
            onPress={() => void handleSave()}
            className="gap-1.5"
          >
            {saved
              ? <Check size={14} strokeWidth={2} aria-hidden />
              : <Save size={14} strokeWidth={2} aria-hidden />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Review'}
          </Button>
        </div>
      </div>

      {showSummary && pgx.summary_text && (
        <pre className="mb-3.5 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface px-3.5 py-2.5 font-mono text-[11px] text-muted">
          {String(pgx.summary_text)}
        </pre>
      )}

      {actionable.length > 0 && (
        <>
          <h4 className="mb-2.5 text-[13px] font-semibold text-muted">Actionable genes ({actionable.length})</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {actionable.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {informative.length > 0 && (
        <>
          <h4 className="mt-4 mb-2.5 text-[13px] font-semibold text-muted">Informative genes ({informative.length})</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {informative.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {customResults.length > 0 && (
        <>
          <h4 className="mt-4 mb-2.5 text-[13px] font-semibold text-muted">Custom genes ({customResults.length})</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {customResults.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {allPharmcatGenes.length > 0 && geneResults.length === 0 && (
        <>
          <h4 className="mb-2.5 text-[13px] font-semibold text-muted">PharmCAT gene results</h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {allPharmcatGenes.map((g) => (
              <GeneCard key={g.gene} gene={g} onToggle={toggleConfirm} />
            ))}
          </div>
        </>
      )}

      {geneResults.length === 0 && customResults.length === 0 && allPharmcatGenes.length === 0 && (
        <p className="py-8 text-center text-muted">No gene results available in PGx data.</p>
      )}
    </div>
  );
}

function GeneCard({ gene: g, onToggle }: { gene: PgxGene; onToggle: (gene: string, confirmed: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      variant="secondary"
      className={g.reviewer_confirmed ? 'border-success bg-success/5' : undefined}
    >
      <Card.Content className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <strong>{g.gene}</strong>
            {g.guideline_source && (
              <Chip size="sm" variant="soft" color="default">
                <Chip.Label>{g.guideline_source}</Chip.Label>
              </Chip>
            )}
          </div>
          <LabeledCheckbox
            isSelected={g.reviewer_confirmed ?? false}
            onChange={(checked) => onToggle(g.gene, checked)}
            contentClassName="text-xs"
          >
            Confirmed
          </LabeledCheckbox>
        </div>

        {g.diplotype && <p className="m-0 font-mono text-xs text-muted">{g.diplotype}</p>}

        {g.phenotype && (
          <Chip color={phenotypeColor(g.phenotype)} size="sm" variant="soft">
            <Chip.Label>{g.phenotype}</Chip.Label>
          </Chip>
        )}

        {g.activity_score !== undefined && (
          <p className="m-0 text-xs text-muted">Activity score: <strong className="text-foreground">{g.activity_score}</strong></p>
        )}

        {(g.allele1_function || g.allele2_function) && (
          <p className="m-0 text-[11px] text-muted">
            {g.allele1_function}{g.allele2_function ? ` / ${g.allele2_function}` : ''}
          </p>
        )}

        {g.recommendations && g.recommendations.length > 0 && (
          <ul className="m-0 mt-0.5 list-disc pl-4 text-xs text-muted">
            {g.recommendations.map((r, i) => <li key={i} className="mb-0.5">{r}</li>)}
          </ul>
        )}

        {g.reviewer_comment && (
          <p className="m-0 text-xs text-muted"><em>{g.reviewer_comment}</em></p>
        )}

        {g.call_source && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto justify-start gap-1 px-0 text-[11px] text-muted"
            onPress={() => setExpanded((v) => !v)}
          >
            {expanded
              ? <ChevronUp size={12} strokeWidth={2} aria-hidden />
              : <ChevronDown size={12} strokeWidth={2} aria-hidden />}
            {expanded ? 'Less' : 'More'}
          </Button>
        )}
        {expanded && (
          <div className="mt-0.5 border-t border-border pt-1.5 text-xs text-muted">
            {g.call_source && <p className="m-0">Call source: {g.call_source}</p>}
            {g.category    && <p className="m-0">Category: {g.category}</p>}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
