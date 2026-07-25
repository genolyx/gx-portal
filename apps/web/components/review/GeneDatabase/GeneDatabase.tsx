'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  TextArea,
} from '@heroui/react';
import { reviewApi } from '../../../lib/api/review';
import { useReviewStore } from '../../../lib/store/reviewStore';
import type {
  GeneKnowledgeRow,
  GeneKnowledgeSaveRequest,
  VariantKnowledgeRow,
} from '@gx-portal/types';

/** Matches gx-daemon make_variant_key: GENE|hgvsc (or GENE|hgvsp). */
function makeVariantKey(gene: string, hgvsc?: string, hgvsp?: string): string {
  const g = (gene || '').trim().toUpperCase();
  const hc = (hgvsc || '').trim();
  const hp = (hgvsp || '').trim();
  if (hc) return `${g}|${hc}`;
  if (hp) return `${g}|${hp}`;
  return `${g}|`;
}

export function GeneDatabase({ orderId }: { orderId: string }) {
  const { reviewData, selectedVariants } = useReviewStore();
  const [genesMap, setGenesMap] = useState<Record<string, GeneKnowledgeRow>>({});
  const [variantsMap, setVariantsMap] = useState<Record<string, VariantKnowledgeRow>>({});
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<'EN' | 'CN' | 'KO'>('EN');
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [hint, setHint] = useState('');
  const [msg, setMsg] = useState('');

  const [editGene, setEditGene] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GeneKnowledgeSaveRequest>({
    gene: '',
    disorder: '',
    omim_number: '',
    inheritance: '',
    function_summary: '',
    disease_association: '',
  });
  const [saving, setSaving] = useState(false);

  const [editVk, setEditVk] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const variants = reviewData?.variants ?? [];
  const selectedGeneSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      if (selectedVariants.has(v.variant_id) && v.gene) set.add(v.gene.toUpperCase());
    }
    return [...set].sort();
  }, [variants, selectedVariants]);

  const rows = useMemo(() => {
    const byGene = new Map<string, typeof variants>();
    for (const v of variants) {
      const g = (v.gene || '').toUpperCase();
      if (!g) continue;
      if (!byGene.has(g)) byGene.set(g, []);
      byGene.get(g)!.push(v);
    }
    const out: {
      gene: string;
      hgvsc?: string;
      hgvsp?: string;
      transcript?: string;
      vk: string;
      gk: GeneKnowledgeRow;
      vkRow: VariantKnowledgeRow;
    }[] = [];
    for (const [gene, vs] of [...byGene.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const gk = genesMap[gene] ?? {};
      for (const v of vs) {
        const vk = makeVariantKey(gene, v.hgvsc, v.hgvsp);
        out.push({
          gene,
          hgvsc: v.hgvsc,
          hgvsp: v.hgvsp,
          transcript: v.clinical_nm ?? v.transcript,
          vk,
          gk,
          vkRow: variantsMap[vk] ?? {},
        });
      }
    }
    return out;
  }, [variants, genesMap, variantsMap]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const blob = [
      r.gene,
      r.hgvsc,
      r.hgvsp,
      r.gk.disorder,
      r.gk.function_summary,
      r.gk.disease_association,
      r.vkRow.variant_notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });

  const applyResponse = useCallback((res: Awaited<ReturnType<typeof reviewApi.getGeneKnowledge>>) => {
    setGenesMap(res.genes ?? {});
    setVariantsMap(res.variants ?? {});
    if (res.gene_knowledge_db_configured === false) {
      setHint(res.message || 'gene_knowledge_db is not configured on the daemon.');
    } else if (res.gemini_available === false && (res.ai_provider ?? 'gemini') === 'gemini') {
      setHint('No Gemini API key — only existing SQLite rows load. Configure GEMINI_API_KEY or switch to Ollama.');
    } else {
      setHint(
        `Shared gene_knowledge SQLite (${res.ai_provider ?? 'gemini'}). Disease association should start with: Pathogenic variants in the GENE gene.`,
      );
    }
    if (res.error) setMsg(res.error);
  }, []);

  const loadKnowledge = useCallback(
    async (enrich: boolean) => {
      if (!orderId) return;
      if (enrich && selectedGeneSymbols.length === 0) {
        setMsg('Select at least one variant before fetching / translating.');
        return;
      }
      if (enrich) setEnriching(true);
      else setLoading(true);
      setMsg('');
      try {
        const res = await reviewApi.getGeneKnowledge(orderId, {
          enrich,
          lang,
          genes: selectedGeneSymbols.length > 0 ? selectedGeneSymbols.join(',') : undefined,
        });
        applyResponse(res);
        if (enrich && !res.error) setMsg(`Gene knowledge updated (${lang}).`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed to load gene knowledge');
      } finally {
        setLoading(false);
        setEnriching(false);
      }
    },
    [orderId, lang, selectedGeneSymbols, applyResponse],
  );

  // Stable gene list for the fetch — avoid refetch when only variant objects are replaced.
  const genesCsv = useMemo(
    () =>
      [...new Set(variants.map((v) => (v.gene || '').toUpperCase()).filter(Boolean))]
        .sort()
        .join(','),
    [variants],
  );

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        // Restrict to genes on this order's variants — avoids expanding the full
        // sgNIPT all_target_variants panel on every Gene DB tab open.
        const res = await reviewApi.getGeneKnowledge(orderId, {
          lang,
          genes: genesCsv || undefined,
        });
        if (cancelled) return;
        applyResponse(res);
      } catch (e) {
        if (!cancelled) setMsg(e instanceof Error ? e.message : 'Failed to load gene knowledge');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, lang, applyResponse, genesCsv]);

  const openGeneEdit = (gene: string) => {
    const gk = genesMap[gene] ?? {};
    setEditGene(gene);
    setEditForm({
      gene,
      lang,
      disorder: String(gk.disorder ?? ''),
      omim_number: String(gk.omim_number ?? ''),
      inheritance: String(gk.inheritance ?? ''),
      function_summary: String(gk.function_summary ?? ''),
      disease_association: String(gk.disease_association ?? ''),
    });
  };

  const saveGeneEdit = async () => {
    if (!editGene || !orderId) return;
    if (selectedGeneSymbols.length === 0) {
      setMsg('Select at least one variant before saving gene text.');
      return;
    }
    setSaving(true);
    try {
      const res = await reviewApi.putGeneKnowledge(
        orderId,
        { ...editForm, gene: editGene, lang },
        selectedGeneSymbols.join(','),
      ) as { row?: GeneKnowledgeRow };
      const row = res.row ?? {};
      setGenesMap((prev) => ({
        ...prev,
        [editGene]: {
          gene_symbol: editGene,
          function_summary: String(row.function_summary ?? editForm.function_summary ?? ''),
          disease_association: String(row.disease_association ?? editForm.disease_association ?? ''),
          disorder: String(row.disorder ?? editForm.disorder ?? ''),
          omim_number: String(row.omim_number ?? editForm.omim_number ?? ''),
          inheritance: String(row.inheritance ?? editForm.inheritance ?? ''),
        },
      }));
      setEditGene(null);
      setMsg('Gene cache saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveVariantNotes = async () => {
    if (!editVk || !orderId) return;
    if (selectedGeneSymbols.length === 0) {
      setMsg('Select at least one variant before saving.');
      return;
    }
    setSavingNotes(true);
    try {
      const res = await reviewApi.putVariantKnowledge(
        orderId,
        { variant_key: editVk, lang, variant_notes: editNotes },
        selectedGeneSymbols.join(','),
      ) as { row?: VariantKnowledgeRow };
      const row = res.row ?? {};
      setVariantsMap((prev) => ({
        ...prev,
        [editVk]: {
          variant_key: editVk,
          variant_notes: String(row.variant_notes ?? editNotes),
          gene_symbol: String(row.gene_symbol ?? ''),
          hgvsc: String(row.hgvsc ?? ''),
          hgvsp: String(row.hgvsp ?? ''),
          updated_at: String(row.updated_at ?? ''),
        },
      }));
      setEditVk(null);
      setMsg('Variant notes saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter gene or text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[260px]"
          aria-label="Search genes"
        />
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted whitespace-nowrap">Narrative language</Label>
          <Select
            selectedKey={lang}
            onSelectionChange={(key) => setLang(String(key) as 'EN' | 'CN' | 'KO')}
          >
            <Select.Trigger className="min-w-[120px]">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="EN" textValue="EN">English (EN)</ListBox.Item>
                <ListBox.Item id="CN" textValue="CN">Chinese (CN)</ListBox.Item>
                <ListBox.Item id="KO" textValue="KO">Korean (KO)</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <span className="text-xs text-muted">
          {loading ? 'Loading…' : `${filtered.length} rows · ${selectedGeneSymbols.length} selected genes`}
        </span>
        <Button
          size="sm"
          variant="primary"
          isDisabled={enriching || !orderId}
          onPress={() => void loadKnowledge(true)}
        >
          {enriching ? 'Fetching…' : 'Fetch / translate from AI'}
        </Button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {variants.length === 0 ? 'Load an order to see variants.' : 'No genes found.'}
        </p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Gene knowledge">
              <Table.Header>
                <Table.Column isRowHeader>Gene</Table.Column>
                <Table.Column>HGVSc / HGVSp</Table.Column>
                <Table.Column>Transcript</Table.Column>
                <Table.Column>Disorder</Table.Column>
                <Table.Column>OMIM</Table.Column>
                <Table.Column>Inheritance</Table.Column>
                <Table.Column>Gene function</Table.Column>
                <Table.Column>Disease association</Table.Column>
                <Table.Column>Variant notes</Table.Column>
                <Table.Column>Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {filtered.map((r) => (
                  <Table.Row key={`${r.gene}-${r.vk}`}>
                    <Table.Cell>
                      <span className="text-xs font-bold">{r.gene}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-xs font-mono leading-snug">
                        <div>{r.hgvsc || '—'}</div>
                        <div className="text-muted">{r.hgvsp || '—'}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs font-mono">{r.transcript || '—'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block max-w-[140px] truncate text-xs" title={String(r.gk.disorder ?? '')}>
                        {String(r.gk.disorder || '—')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{String(r.gk.omim_number || '—')}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs">{String(r.gk.inheritance || '—')}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className="block max-w-[180px] truncate text-xs text-muted"
                        title={String(r.gk.function_summary ?? '')}
                      >
                        {String(r.gk.function_summary || '—')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className="block max-w-[180px] truncate text-xs text-muted"
                        title={String(r.gk.disease_association ?? '')}
                      >
                        {String(r.gk.disease_association || '—')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className="block max-w-[140px] truncate text-xs text-muted"
                        title={String(r.vkRow.variant_notes ?? '')}
                      >
                        {String(r.vkRow.variant_notes || '—')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" onPress={() => openGeneEdit(r.gene)}>
                          Edit gene
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setEditVk(r.vk);
                            setEditNotes(String(r.vkRow.variant_notes ?? ''));
                          }}
                        >
                          Edit notes
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <Modal isOpen={editGene != null} onOpenChange={(open) => !open && setEditGene(null)}>
        <Modal.Backdrop>
          <Modal.Container scroll="inside">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Edit gene — {editGene}</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Disorder</Label>
                  <Input
                    value={editForm.disorder ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, disorder: e.target.value }))}
                    fullWidth
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>OMIM</Label>
                    <Input
                      value={editForm.omim_number ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, omim_number: e.target.value }))}
                      fullWidth
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Inheritance</Label>
                    <Input
                      value={editForm.inheritance ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, inheritance: e.target.value }))}
                      fullWidth
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Gene function (summary)</Label>
                  <TextArea
                    value={editForm.function_summary ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, function_summary: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Disease association</Label>
                  <TextArea
                    value={editForm.disease_association ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, disease_association: e.target.value }))}
                    rows={4}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setEditGene(null)}>Cancel</Button>
                <Button variant="primary" isDisabled={saving} onPress={() => void saveGeneEdit()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={editVk != null} onOpenChange={(open) => !open && setEditVk(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Variant notes</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-xs font-mono text-muted break-all">{editVk}</p>
                <TextArea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={6}
                  placeholder="Interpretation, literature, or lab notes specific to this HGVS…"
                />
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setEditVk(null)}>Cancel</Button>
                <Button variant="primary" isDisabled={savingNotes} onPress={() => void saveVariantNotes()}>
                  {savingNotes ? 'Saving…' : 'Save'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
