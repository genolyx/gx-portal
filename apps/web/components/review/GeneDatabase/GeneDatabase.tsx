'use client';

import { useEffect, useState } from 'react';
import { Input, Table } from '@heroui/react';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type { GeneKnowledge } from '@gx-portal/types';

export function GeneDatabase() {
  const { reviewData } = useReviewStore();
  const [genes, setGenes] = useState<GeneKnowledge[]>([]);
  const [search, setSearch] = useState('');

  const variants = reviewData?.variants ?? [];
  const uniqueGenes = [...new Set(variants.map((v) => v.gene).filter(Boolean))].sort();

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search gene or disorder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[260px]"
          aria-label="Search genes"
        />
        <span className="self-center text-xs text-muted">
          {filtered.length} / {uniqueGenes.length} genes in this order
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted">No genes found.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Gene knowledge">
              <Table.Header>
                <Table.Column isRowHeader>Gene</Table.Column>
                <Table.Column>Disorder / Disease</Table.Column>
                <Table.Column>Inheritance</Table.Column>
                <Table.Column>Notes</Table.Column>
              </Table.Header>
              <Table.Body>
                {filtered.map((g) => (
                  <Table.Row key={g.gene}>
                    <Table.Cell>
                      <span className="text-xs font-bold">{g.gene}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block max-w-xs truncate text-xs" title={g.disorder ?? ''}>
                        {g.disorder || <span className="text-muted">—</span>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{g.inheritance || <span className="text-muted">—</span>}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs text-muted">{g.notes ?? g.function_summary ?? '—'}</span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </div>
  );
}
