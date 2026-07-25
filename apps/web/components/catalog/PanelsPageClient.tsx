'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
} from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { catalogApi, type PanelPackage } from '../../lib/api/catalog';
import { LabeledCheckbox } from '../ui/LabeledCheckbox';
import { PageHeader } from '../ui/PageHeader';
import { RefreshButton } from '../ui/RefreshButton';

const CATEGORIES = [
  { value: 'carrier_screening', label: 'Carrier screening' },
  { value: 'proactive_health', label: 'Proactive health' },
  { value: 'pgx', label: 'Pharmacogenomics (PGx)' },
  { value: 'other', label: 'Other' },
];

const emptyForm = () => ({
  id: '',
  label: '',
  category: 'carrier_screening',
  description: '',
  genes: '',
  interpretationGenesOnly: true,
});

export function PanelsPageClient() {
  const [panels, setPanels] = useState<PanelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState(emptyForm());

  const [expanded, setExpanded] = useState<string | null>(null);
  const [geneCache, setGeneCache] = useState<Record<string, string[]>>({});
  const [geneLoading, setGeneLoading] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const res = await catalogApi.getPanels();
      setPanels(res.panels ?? []);
    } catch (e) {
      setPanels([]);
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh panels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleToggleGenes = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (geneCache[id]) return;
    setGeneLoading(id);
    try {
      const full = await catalogApi.getPanel(id);
      const genes = Array.isArray(full.interpretation_genes)
        ? (full.interpretation_genes as string[])
        : [];
      setGeneCache((c) => ({ ...c, [id]: genes }));
    } catch {
      setGeneCache((c) => ({ ...c, [id]: [] }));
    } finally {
      setGeneLoading(null);
    }
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.label.trim()) {
      setSaveMsg('Package ID and Display name are required.');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(form.id.trim())) {
      setSaveMsg('Package ID: lowercase letters, digits, _ or - only.');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      const body = {
        id: form.id.trim(),
        label: form.label.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        genes: form.genes
          .split(/[\n,]+/)
          .map((g) => g.trim())
          .filter(Boolean),
        interpretation_genes_only: form.interpretationGenesOnly,
      };
      await catalogApi.savePanel(body);
      setSaveMsg('✓ Package saved');
      setForm(emptyForm());
      setGeneCache({});
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete panel "${id}"?`)) return;
    try {
      await catalogApi.deletePanel(id);
      setGeneCache((c) => {
        const n = { ...c };
        delete n[id];
        return n;
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleEdit = async (p: PanelPackage) => {
    setForm({
      id: p.id,
      label: p.label,
      category: p.category ?? 'carrier_screening',
      description: p.description ?? '',
      genes: '',
      interpretationGenesOnly: p.interpretation_genes_only ?? true,
    });
    try {
      const full = await catalogApi.getPanel(p.id);
      const genes = Array.isArray(full.interpretation_genes)
        ? (full.interpretation_genes as string[])
        : [];
      setForm((f) => ({ ...f, genes: genes.join('\n') }));
      setGeneCache((c) => ({ ...c, [p.id]: genes }));
    } catch {
      /* bundled panel — no gene list */
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const geneCount = form.genes.split(/[\n,]+/).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Panels"
        description="WES / exome panel packages — named gene lists for carrier order interpretation."
      />

      <Card className="mb-5">
        <Card.Header>
          <Card.Title>New or update package</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Package ID *</Label>
              <Input
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. carrier_500_v1"
                fullWidth
              />
              <p className="text-xs text-muted">
                Lowercase letters, digits, <code>_</code> <code>-</code> only.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Display name *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Carrier screening 500 genes"
                fullWidth
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select
                selectedKey={form.category}
                onSelectionChange={(key) => setForm({ ...form, category: String(key) })}
                fullWidth
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {CATEGORIES.map((c) => (
                      <ListBox.Item key={c.value} id={c.value} textValue={c.label}>
                        {c.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="col-span-full flex flex-col gap-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional — internal note"
                fullWidth
              />
            </div>
            <div className="col-span-full flex flex-col gap-1.5">
              <Label>
                Gene list (one per line or comma-separated)
                {form.genes && (
                  <span className="text-muted font-normal"> — {geneCount} genes</span>
                )}
              </Label>
              <TextArea
                value={form.genes}
                onChange={(e) => setForm({ ...form, genes: e.target.value })}
                rows={6}
                placeholder={'BRCA1\nCFTR\nSMN1'}
                fullWidth
              />
            </div>
            <div className="col-span-full">
              <LabeledCheckbox
                isSelected={form.interpretationGenesOnly}
                onChange={(checked) => setForm({ ...form, interpretationGenesOnly: checked })}
              >
                <span className="text-sm">
                  <strong>Gene list only</strong> (recommended) — saves symbols for post-analysis
                  reporting. No extra files.
                </span>
              </LabeledCheckbox>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" isDisabled={saving} onPress={handleSave}>
              {saving ? 'Saving…' : 'Save package'}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setForm(emptyForm())}>
              Reset
            </Button>
            {saveMsg && (
              <span className={saveMsg.startsWith('✓') ? 'text-sm text-success' : 'text-sm text-danger'}>
                {saveMsg}
              </span>
            )}
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Card.Title>Saved packages</Card.Title>
            <RefreshButton
              variant="ghost"
              label="Refresh"
              successToast="Panels refreshed"
              isLoading={loading}
              onPress={() => load(true)}
            />
          </div>
        </Card.Header>
        <Card.Content>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : panels.length === 0 ? (
            <p className="text-muted">No panel packages saved.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-left text-muted">
                  <tr>
                    <th className="p-2 w-6" />
                    <th className="p-2">Name</th>
                    <th className="p-2">ID</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 text-right">Genes</th>
                    <th className="p-2">Source</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {panels.map((p) => {
                    const isOpen = expanded === p.id;
                    const isLoading = geneLoading === p.id;
                    const genes = geneCache[p.id] ?? [];
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className="border-t border-border cursor-pointer hover:bg-surface-secondary/50"
                          onClick={() => handleToggleGenes(p.id)}
                        >
                          <td className="p-2 text-muted text-xs">
                            {isLoading ? '…' : isOpen ? '▾' : '▸'}
                          </td>
                          <td className="p-2 font-medium">{p.label}</td>
                          <td className="p-2 font-mono text-muted">{p.id}</td>
                          <td className="p-2 text-muted">{p.category ?? '—'}</td>
                          <td className="p-2 font-mono text-right">
                            {isOpen && genes.length > 0 ? genes.length : (p.gene_count ?? '—')}
                          </td>
                          <td className="p-2 text-muted">{p.source ?? '—'}</td>
                          <td className="p-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label={`Edit ${p.label}`}
                                onPress={() => handleEdit(p)}
                              >
                                <Pencil size={15} strokeWidth={2} aria-hidden />
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                isIconOnly
                                aria-label={`Delete ${p.label}`}
                                onPress={() => handleDelete(p.id)}
                              >
                                <Trash2 size={15} strokeWidth={2} aria-hidden />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-t border-border bg-surface-secondary">
                            <td colSpan={7} className="p-3 pl-10">
                              {isLoading ? (
                                <span className="text-muted">Loading gene list…</span>
                              ) : genes.length === 0 ? (
                                <span className="text-muted">No gene list found for this panel.</span>
                              ) : (
                                <div>
                                  <div className="text-xs text-muted mb-2">
                                    {genes.length} interpretation genes
                                    {p.description && (
                                      <span className="ml-3 italic">{p.description}</span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-2 bg-surface border border-border rounded-lg">
                                    {genes.map((g) => (
                                      <Chip key={g} size="sm" variant="soft">
                                        <Chip.Label className="font-mono text-xs">{g}</Chip.Label>
                                      </Chip>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
