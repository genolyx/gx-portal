'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextArea,
} from '@heroui/react';
import { reviewApi } from '../../../lib/api/review';
import { isSgniptReviewData } from '../../../lib/sgnipt-normalize';
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

const PAGE_SIZE = 80;
/** Cap gene list sent to the API — huge sgNIPT panels otherwise stall the tab. */
const MAX_GENES_FOR_FETCH = 250;

export function GeneDatabase({ orderId }: { orderId: string }) {
  const reviewData = useReviewStore((s) => s.reviewData);
  const selectedVariants = useReviewStore((s) => s.selectedVariants);

  const [genesMap, setGenesMap] = useState<Record<string, GeneKnowledgeRow>>({});
  const [variantsMap, setVariantsMap] = useState<Record<string, VariantKnowledgeRow>>({});
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<'EN' | 'CN' | 'KO'>('EN');
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [hint, setHint] = useState('');
  const [msg, setMsg] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isSgnipt = isSgniptReviewData(reviewData as Record<string, unknown> | null);
  /** Large panels: default to selected variants only so the table stays usable. */
  const [selectedOnly, setSelectedOnly] = useState(() => isSgnipt);

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

  const sourceVariants = useMemo(() => {
    if (!selectedOnly) return variants;
    if (selectedVariants.size === 0) return variants;
    return variants.filter((v) => selectedVariants.has(v.variant_id));
  }, [variants, selectedOnly, selectedVariants]);

  const rows = useMemo(() => {
    const byGene = new Map<string, typeof sourceVariants>();
    for (const v of sourceVariants) {
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
  }, [sourceVariants, genesMap, variantsMap]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
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
  }, [rows, search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, selectedOnly, lang, orderId]);

  const pageRows = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;

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

  // Genes for API fetch — prefer selected; otherwise unique genes capped for sgNIPT.
  const genesForFetch = useMemo(() => {
    const preferred = selectedGeneSymbols.length > 0
      ? selectedGeneSymbols
      : [...new Set(variants.map((v) => (v.gene || '').toUpperCase()).filter(Boolean))].sort();
    if (preferred.length <= MAX_GENES_FOR_FETCH) return preferred;
    return preferred.slice(0, MAX_GENES_FOR_FETCH);
  }, [variants, selectedGeneSymbols]);

  const genesCsv = genesForFetch.join(',');

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
          genes: enrich
            ? selectedGeneSymbols.join(',')
            : (genesCsv || undefined),
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
    [orderId, lang, selectedGeneSymbols, genesCsv, applyResponse],
  );

  useEffect(() => {
    if (!orderId) return;
    const ac = new AbortController();
    setLoading(true);
    setMsg('');
    const url = `/api/review/${encodeURIComponent(orderId)}/gene-knowledge`;
    console.info(`[review/genedb] fetch start ${url}`, { genes: genesForFetch.length });

    void (async () => {
      const started = performance.now();
      try {
        const res = await reviewApi.getGeneKnowledge(orderId, {
          lang,
          genes: genesCsv || undefined,
        });
        if (ac.signal.aborted) return;
        console.info(`[review/genedb] fetch ok (${Math.round(performance.now() - started)}ms)`);
        applyResponse(res);
      } catch (e) {
        if (ac.signal.aborted) return;
        console.warn(`[review/genedb] fetch failed`, e);
        setMsg(e instanceof Error ? e.message : 'Failed to load gene knowledge');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [orderId, lang, applyResponse, genesCsv, genesForFetch.length]);

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
        <Button
          size="sm"
          variant={selectedOnly ? 'secondary' : 'ghost'}
          onPress={() => setSelectedOnly((v) => !v)}
        >
          {selectedOnly
            ? `Selected only (${selectedVariants.size || 'all if none'})`
            : 'All variants'}
        </Button>
        <span className="text-xs text-muted">
          {loading
            ? 'Loading…'
            : `Showing ${Math.min(visibleCount, filtered.length)} of ${filtered.length} · ${selectedGeneSymbols.length} selected genes`}
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

      {loading && filtered.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted">
          <Spinner size="lg" color="accent" />
          <p className="text-sm">Loading gene knowledge…</p>
          <p className="text-xs font-mono">
            GET /api/review/{orderId}/gene-knowledge
            {genesForFetch.length > 0 ? ` (${genesForFetch.length} genes)` : ''}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {variants.length === 0
            ? 'Load an order to see variants.'
            : selectedOnly && selectedVariants.size === 0
              ? 'No variants selected — turn off “Selected only”, or select variants in the Variants tab.'
              : 'No genes found.'}
        </p>
      ) : (
        <>
          {loading && (
            <div className="mb-2 flex items-center gap-2 text-xs text-muted">
              <Spinner size="sm" color="current" />
              Refreshing gene knowledge…
            </div>
          )}
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  {[
                    'Gene', 'HGVSc / HGVSp', 'Transcript', 'Disorder', 'OMIM',
                    'Inheritance', 'Gene function', 'Disease association', 'Variant notes', 'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="sticky top-0 z-10 bg-surface px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={`${r.gene}-${r.vk}`} className="border-b border-border hover:bg-accent/5">
                    <td className="px-2.5 py-1.5 font-bold whitespace-nowrap">{r.gene}</td>
                    <td className="px-2.5 py-1.5 font-mono leading-snug">
                      <div>{r.hgvsc || '—'}</div>
                      <div className="text-muted">{r.hgvsp || '—'}</div>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">{r.transcript || '—'}</td>
                    <td className="px-2.5 py-1.5">
                      <span className="block max-w-[140px] truncate" title={String(r.gk.disorder ?? '')}>
                        {String(r.gk.disorder || '—')}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{String(r.gk.omim_number || '—')}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{String(r.gk.inheritance || '—')}</td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className="block max-w-[180px] truncate text-muted"
                        title={String(r.gk.function_summary ?? '')}
                      >
                        {String(r.gk.function_summary || '—')}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className="block max-w-[180px] truncate text-muted"
                        title={String(r.gk.disease_association ?? '')}
                      >
                        {String(r.gk.disease_association || '—')}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span
                        className="block max-w-[140px] truncate text-muted"
                        title={String(r.vkRow.variant_notes ?? '')}
                      >
                        {String(r.vkRow.variant_notes || '—')}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 items-start">
                        <button
                          type="button"
                          className="text-[11px] font-medium text-accent hover:underline bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => openGeneEdit(r.gene)}
                        >
                          Edit gene
                        </button>
                        <button
                          type="button"
                          className="text-[11px] font-medium text-accent hover:underline bg-transparent border-0 p-0 cursor-pointer"
                          onClick={() => {
                            setEditVk(r.vk);
                            setEditNotes(String(r.vkRow.variant_notes ?? ''));
                          }}
                        >
                          Edit notes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-2 flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Show more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
          {genesForFetch.length >= MAX_GENES_FOR_FETCH && (
            <p className="mt-2 text-xs text-muted">
              Gene knowledge fetch capped at {MAX_GENES_FOR_FETCH} genes. Select specific variants
              for targeted fetch / translate.
            </p>
          )}
        </>
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
