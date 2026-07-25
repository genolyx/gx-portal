'use client';

import { Button } from '@heroui/react';
import type { PgxGeneResult, PgxApoePhasing, PgxApoeDiplotypeForReport } from '@gx-portal/types';

interface Props {
  customGenes: PgxGeneResult[];
  apoePhasing: PgxApoePhasing | undefined;
  apoeDiplotype: PgxApoeDiplotypeForReport | string | undefined;
  includeApoePdf: boolean;
  onToggleIncludePdf: (v: boolean) => void;
  orderId: string;
  onOpenApoeIgv?: (relPath: string) => void;
  igvRelPath: string;
}

const RISK_LEGEND = [
  ['ε2/ε2', 'Reduced risk'],
  ['ε2/ε3', 'Slightly reduced'],
  ['ε3/ε3', 'Baseline'],
  ['ε2/ε4', 'Intermediate'],
  ['ε3/ε4', 'Moderate increase'],
  ['ε4/ε4', 'High risk'],
] as const;

function tagRole(rsid: string): string {
  if (rsid === 'rs429358') return 'ε4 vs ε3 (112)';
  if (rsid === 'rs7412') return 'ε2 vs ε3 (158)';
  return '';
}

function DiplotypeAlerts({ apoeDiplotype }: { apoeDiplotype: PgxApoeDiplotypeForReport | string | undefined }) {
  const adp = apoeDiplotype && typeof apoeDiplotype === 'object' ? apoeDiplotype : null;
  if (!adp) return null;
  const rk = String(adp.report_key || '').trim();

  if (rk === 'ε2/ε4' || rk === 'ε3/ε4' || rk === 'ε4/ε4') {
    const labels: Record<string, string> = { 'ε2/ε4': 'Intermediate', 'ε3/ε4': 'Moderate increase', 'ε4/ε4': 'High risk' };
    const label = labels[rk] ?? '';
    const isHigh = rk === 'ε4/ε4';
    return (
      <div className={`mb-3 rounded-lg border-2 p-3 text-xs leading-relaxed ${isHigh ? 'border-red-500/65 bg-red-50/65 text-red-900' : 'border-amber-500/65 bg-amber-50/90 text-amber-900'}`}>
        <strong className="mb-1 block">Clinical alert — APOE</strong>
        Diplotype <strong>{rk.replace(/\//g, ' / ')}</strong>: Alzheimer disease risk — <strong>{label}</strong>. Review in full clinical context.
      </div>
    );
  }

  if (rk === 'ambiguous_both_het' || rk === 'unknown') {
    return (
      <div className="mb-3 rounded-lg border-2 border-red-500/65 bg-red-50/65 p-3 text-xs leading-relaxed text-red-900">
        <strong className="mb-1 block">Phasing alert — APOE</strong>
        ε2/ε3/ε4 haplotype phase could not be determined from the tag-SNP data in this review. Do not report a definitive ε2/ε3/ε4 diplotype for counseling without resolving phase per laboratory policy.
      </div>
    );
  }

  return null;
}

export function ApoeProactiveCard({
  customGenes,
  apoePhasing,
  apoeDiplotype,
  includeApoePdf,
  onToggleIncludePdf,
  onOpenApoeIgv,
  igvRelPath,
}: Props) {
  const rows = customGenes
    .filter((r) => String(r.gene || '').trim().toUpperCase() === 'APOE')
    .sort((a, b) => String(a.rsid || '').localeCompare(String(b.rsid || '')));

  if (!rows.length) return null;

  const aph = apoePhasing;

  let phaseLine: string | null = null;
  if (aph) {
    const st = aph.status;
    if (st === 'ambiguous') {
      phaseLine = 'ε2/ε3/ε4 cannot be resolved when both tag SNPs are heterozygous on unphased short reads—follow the APOE phasing banner above and lab policy.';
    } else if (st === 'incomplete') {
      phaseLine = 'incomplete output (both rs429358 and rs7412 should be present).';
    } else if (st === 'likely_unambiguous') {
      phaseLine = 'at least one locus is homozygous—ε2/ε3/ε4 is often inferable without cross-SNP phasing; confirm per laboratory policy.';
    } else if (st === 'pipeline_resolved') {
      phaseLine = 'marked resolved in pipeline output—confirm in pgx_custom_result.json / SOP.';
    } else if (st === 'unknown_zygosity') {
      phaseLine = 'zygosity could not be assessed from the extended panel rows—see warning above.';
    }
  }

  return (
    <div className="mb-3.5 rounded-xl border border-blue-500/40 bg-blue-500/[.07] p-3.5 text-xs leading-relaxed">
      <strong className="mb-2 block text-[13px]">APOE result (proactive health)</strong>

      <DiplotypeAlerts apoeDiplotype={apoeDiplotype} />

      <p className="mb-3 text-[11px] leading-snug text-muted">
        Tag SNPs <strong>rs429358</strong> (Cys112Arg) and <strong>rs7412</strong> (Arg158Cys) define <strong>ε2 / ε3 / ε4</strong> in standard nomenclature.{' '}
        For proactive orders, interpret <strong>APOE</strong> here for <strong>ε2/ε3/ε4</strong> and preventive-health context; rows in the table below may still show <strong>ClinPGx drug-gene</strong> text.
      </p>

      <div className="mb-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-1.5 text-left">rsID</th>
              <th className="border-b border-border px-2 py-1.5 text-left">Genotype</th>
              <th className="border-b border-border px-2 py-1.5 text-left">Zygosity</th>
              <th className="border-b border-border px-2 py-1.5 text-left">Tag role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rsid}>
                <td className="px-2 py-1.5 font-mono text-[11px]">{r.rsid}</td>
                <td className="px-2 py-1.5 font-mono text-[11px]">{r.genotype ?? ''}</td>
                <td className="px-2 py-1.5">{(r.zygosity || '').replace(/_/g, ' ')}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted">{tagRole(r.rsid || '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {phaseLine && (
        <p className="mt-2.5 text-[11px] leading-snug">
          <strong>Phase / haplotype:</strong> {phaseLine}
        </p>
      )}

      {igvRelPath && onOpenApoeIgv && (
        <div className="mt-3 border-t border-blue-500/30 pt-2.5">
          <Button
            size="sm"
            className="bg-purple-600 text-white hover:bg-purple-700"
            onPress={() => onOpenApoeIgv(igvRelPath)}
          >
            APOE IGV — Cis/Trans Review
          </Button>
          <span className="ml-2 text-[11px] text-muted">IGV phasing view.</span>
        </div>
      )}

      <div className="mt-3 border-t border-blue-500/30 pt-2.5">
        <p className="mb-1.5 text-[11px] font-semibold">APOE diplotype (ε2/ε3/ε4)</p>
        <ul className="mb-2.5 list-disc pl-4 text-[10px] leading-snug text-muted">
          {RISK_LEGEND.map(([k, v]) => (
            <li key={k}>{k} → {v}</li>
          ))}
        </ul>
        <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            checked={includeApoePdf}
            onChange={(e) => onToggleIncludePdf(e.target.checked)}
          />
          <span>
            Include APOE summary in the <strong>customer PDF</strong> (saved with <strong>Save PGx review</strong>).
          </span>
        </label>
      </div>
    </div>
  );
}
