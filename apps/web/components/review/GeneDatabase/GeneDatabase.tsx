'use client';

import { useEffect, useState } from 'react';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { GeneKnowledge } from '@gx-portal/types';

export function GeneDatabase() {
  const { reviewData } = useReviewStore();
  const [genes, setGenes] = useState<GeneKnowledge[]>([]);
  const [search, setSearch] = useState('');

  const variants = reviewData?.variants ?? [];
  const uniqueGenes = [...new Set(variants.map((v) => v.gene).filter(Boolean))].sort();

  // Build a simple inline knowledge base from variant data already loaded
  useEffect(() => {
    const map: Record<string, GeneKnowledge> = {};
    variants.forEach((v) => {
      if (!v.gene) return;
      if (!map[v.gene]) {
        map[v.gene] = {
          gene: v.gene,
          disorder: (v.diseases ?? (v.disease ? [v.disease] : [])).join('; '),
          inheritance: v.inheritance,
        };
      }
    });
    setGenes(Object.values(map));
  }, [variants]);

  const filtered = genes.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.gene.toLowerCase().includes(q) || (g.disorder ?? '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Search gene or disorder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, minWidth: 260 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} / {uniqueGenes.length} genes in this order
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No genes found.</p>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Gene', 'Disorder / Disease', 'Inheritance', 'Notes'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.gene} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', fontWeight: 700 }}>{g.gene}</td>
                  <td style={{ padding: '6px 12px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.disorder ?? ''}>
                    {g.disorder || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 12px' }}>{g.inheritance || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{g.notes ?? g.function_summary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
