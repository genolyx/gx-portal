'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
import { catalogApi, type CapturePanel, type GvcPanel, type PanelPackage } from '../../lib/api/catalog';
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

const emptyCaptureForm = () => ({
  id: '',
  label: '',
  primaryBed: '',
  captureBed: '',
});

export function PanelsPageClient() {
  const [panels, setPanels] = useState<PanelPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [captureKits, setCaptureKits] = useState<CapturePanel[]>([]);
  const [captureForm, setCaptureForm] = useState(emptyCaptureForm());
  const [captureSaving, setCaptureSaving] = useState(false);
  const [captureMsg, setCaptureMsg] = useState('');
  const [gvcPanels, setGvcPanels] = useState<GvcPanel[]>([]);
  const [gvcForm, setGvcForm] = useState({ name: '', code: '', previousCode: '' });
  const gvcFormRef = useRef<HTMLDivElement>(null);
  const [gvcSaving, setGvcSaving] = useState(false);
  const [gvcMsg, setGvcMsg] = useState('');

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

  const loadCaptureKits = useCallback(async () => {
    try {
      const res = await catalogApi.getCapturePanels();
      setCaptureKits(res.panels ?? []);
    } catch {
      setCaptureKits([]);
    }
  }, []);

  const loadGvcPanels = useCallback(async () => {
    try {
      const res = await catalogApi.getGvcPanels();
      setGvcPanels(res.panels ?? []);
    } catch {
      setGvcPanels([]);
    }
  }, []);

  useEffect(() => {
    void load(false);
    void loadCaptureKits();
    void loadGvcPanels();
  }, [load, loadCaptureKits, loadGvcPanels]);

  const saveCaptureKit = async () => {
    const id = captureForm.id.trim();
    const label = captureForm.label.trim();
    if (!id || !label) {
      setCaptureMsg('Panel ID and display name are required.');
      return;
    }
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(id)) {
      setCaptureMsg('Panel ID: start with a letter; lowercase letters, digits, _ or - only.');
      return;
    }
    if (id !== 'twist-exome2' && !captureForm.primaryBed.trim()) {
      setCaptureMsg('Primary BED is required for a new capture panel.');
      return;
    }
    setCaptureSaving(true);
    setCaptureMsg('');
    try {
      await catalogApi.saveCapturePanel({
        id,
        label,
        primary_bed: captureForm.primaryBed.trim() || undefined,
        capture_bed: captureForm.captureBed.trim() || undefined,
      });
      setCaptureMsg('✓ Capture panel saved');
      setCaptureForm(emptyCaptureForm());
      await loadCaptureKits();
    } catch (err) {
      setCaptureMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCaptureSaving(false);
    }
  };

  const saveGvcPanel = async () => {
    const name = gvcForm.name.trim();
    const code = gvcForm.code.trim();
    if (!name) {
      setGvcMsg('Name is required.');
      return;
    }
    if (!code) {
      setGvcMsg('Code is required.');
      return;
    }
    setGvcSaving(true);
    setGvcMsg('');
    try {
      const res = await catalogApi.saveGvcPanel({
        name,
        code,
        previousCode: gvcForm.previousCode || undefined,
      });
      setGvcPanels(res.panels ?? []);
      setGvcForm({ name: '', code: '', previousCode: '' });
      setGvcMsg(gvcForm.previousCode ? '✓ GVC panel updated' : '✓ GVC panel saved');
    } catch (err) {
      setGvcMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setGvcSaving(false);
    }
  };

  const editGvcPanel = (panel: GvcPanel) => {
    setGvcForm({ name: panel.name, code: panel.code, previousCode: panel.code });
    setGvcMsg('');
    requestAnimationFrame(() => {
      gvcFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      gvcFormRef.current?.querySelector('input')?.focus();
    });
  };

  const deleteGvcPanel = async (panel: GvcPanel) => {
    if (!confirm(`Remove GVC panel "${panel.name}" (${panel.code})? Orders that already saved this code keep it.`)) return;
    try {
      const res = await catalogApi.deleteGvcPanel(panel.code);
      setGvcPanels(res.panels ?? []);
      if (gvcForm.previousCode === panel.code) setGvcForm({ name: '', code: '', previousCode: '' });
    } catch (err) {
      setGvcMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const editCaptureKit = (kit: CapturePanel) => {
    setCaptureForm({
      id: kit.id,
      label: kit.label,
      primaryBed: kit.primary_bed ?? '',
      captureBed: kit.capture_bed ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setDefaultCaptureKit = async (id: string) => {
    setCaptureMsg('');
    try {
      const res = await catalogApi.setDefaultCapturePanel(id);
      setCaptureKits(res.panels ?? []);
      setCaptureMsg('✓ Default capture panel updated');
    } catch (err) {
      setCaptureMsg(err instanceof Error ? err.message : 'Could not set default');
    }
  };

  const deleteCaptureKit = async (id: string) => {
    if (!confirm(`Delete capture panel "${id}"?`)) return;
    try {
      await catalogApi.deleteCapturePanel(id);
      await loadCaptureKits();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

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
        skip_generated_bed: form.interpretationGenesOnly,
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
        description="Capture panel is the sequencing kit. Interpretation package is the portal gene list. A GVC panel is a list already saved in GVC: the name is what Create Order shows, and the code is what GVC matches."
      />

      <Card className="mb-5">
        <Card.Header>
          <Card.Title>Capture panel</Card.Title>
          <Card.Description>
            Sequencing kit for the order. Primary BED is the calling target. Capture BED is optional and used only for QC.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Panel ID *</Label>
              <Input
                value={captureForm.id}
                onChange={(e) => setCaptureForm({ ...captureForm, id: e.target.value })}
                placeholder="e.g. roche-hyperexome-v1"
                fullWidth
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Display name *</Label>
              <Input
                value={captureForm.label}
                onChange={(e) => setCaptureForm({ ...captureForm, label: e.target.value })}
                placeholder="e.g. Roche HyperExome v1"
                fullWidth
              />
            </div>
            <div className="col-span-full flex flex-col gap-1.5">
              <Label>Primary BED *</Label>
              <Input
                value={captureForm.primaryBed}
                onChange={(e) => setCaptureForm({ ...captureForm, primaryBed: e.target.value })}
                placeholder="Host path to primary.bed / targets.bed"
                fullWidth
              />
            </div>
            <div className="col-span-full flex flex-col gap-1.5">
              <Label>Capture BED (QC only, optional)</Label>
              <Input
                value={captureForm.captureBed}
                onChange={(e) => setCaptureForm({ ...captureForm, captureBed: e.target.value })}
                placeholder="Host path to capture.bed"
                fullWidth
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" isDisabled={captureSaving} onPress={() => void saveCaptureKit()}>
              {captureSaving ? 'Saving…' : 'Save capture panel'}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setCaptureForm(emptyCaptureForm())}>
              Reset
            </Button>
            {captureMsg && (
              <span className={captureMsg.startsWith('✓') ? 'text-sm text-success' : 'text-sm text-danger'}>
                {captureMsg}
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-left text-muted">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Default</th>
                  <th className="p-2">ID</th>
                  <th className="p-2">Primary BED</th>
                  <th className="p-2">Capture BED</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {captureKits.map((kit) => (
                  <tr key={kit.id} className="border-t border-border">
                    <td className="p-2 font-medium">{kit.label}</td>
                    <td className="p-2">
                      {kit.default ? (
                        <Chip size="sm" variant="soft" color="accent">
                          <Chip.Label>Default</Chip.Label>
                        </Chip>
                      ) : (
                        <Button size="sm" variant="ghost" onPress={() => void setDefaultCaptureKit(kit.id)}>
                          Set default
                        </Button>
                      )}
                    </td>
                    <td className="p-2 font-mono text-muted">{kit.id}</td>
                    <td className="p-2 font-mono text-xs">{kit.primary_bed || '—'}</td>
                    <td className="p-2 font-mono text-xs">{kit.capture_bed || '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Edit ${kit.label}`} onPress={() => editCaptureKit(kit)}>
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </Button>
                        <Button size="sm" variant="danger" isIconOnly aria-label={`Delete ${kit.label}`} onPress={() => void deleteCaptureKit(kit.id)}>
                          <Trash2 size={15} strokeWidth={2} aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      <Card className="mb-5" id="gvc-panels">
        <Card.Header>
          <Card.Title>GVC panel</Card.Title>
          <Card.Description>
            Register a panel that already exists in GVC. The name is the label in Create Order. The code is pasted from GVC and is required.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {gvcForm.previousCode && (
            <p className="m-0 rounded-lg bg-surface-secondary px-3 py-2 text-sm">
              Editing <span className="font-medium">{gvcForm.name || gvcForm.previousCode}</span>. Change the name or code here, then choose Save changes.
            </p>
          )}
          <div ref={gvcFormRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name *</Label>
              <Input
                value={gvcForm.name}
                onChange={(e) => setGvcForm({ ...gvcForm, name: e.target.value })}
                placeholder="e.g. Carrier 2000+"
                fullWidth
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Code <span className="text-danger">*</span></Label>
              <Input
                value={gvcForm.code}
                onChange={(e) => setGvcForm({ ...gvcForm, code: e.target.value })}
                placeholder="Paste the code from GVC"
                required
                fullWidth
              />
              <p className="text-xs text-muted">
                Paste the code GVC created. This value is sent when the order is classified.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" isDisabled={gvcSaving || !gvcForm.name.trim() || !gvcForm.code.trim()} onPress={() => void saveGvcPanel()}>
              {gvcSaving ? 'Saving…' : gvcForm.previousCode ? 'Save changes' : 'Add GVC panel'}
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setGvcForm({ name: '', code: '', previousCode: '' })}>
              Reset
            </Button>
            {gvcMsg && (
              <span className={gvcMsg.startsWith('✓') ? 'text-sm text-success' : 'text-sm text-danger'}>
                {gvcMsg}
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-left text-muted">
                <tr>
                  <th className="p-2">Name</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {gvcPanels.map((panel) => (
                  <tr key={panel.code} className="border-t border-border">
                    <td className="p-2 font-medium">{panel.name}</td>
                    <td className="p-2 font-mono text-muted">{panel.code}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Edit ${panel.name}`} onPress={() => editGvcPanel(panel)}>
                          <Pencil size={15} strokeWidth={2} aria-hidden />
                        </Button>
                        <Button size="sm" variant="danger" isIconOnly aria-label={`Delete ${panel.name}`} onPress={() => void deleteGvcPanel(panel)}>
                          <Trash2 size={15} strokeWidth={2} aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {gvcPanels.length === 0 && (
                  <tr className="border-t border-border">
                    <td className="p-2 text-muted" colSpan={3}>No GVC panels yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      <Card className="mb-5">
        <Card.Header>
          <Card.Title>Interpretation package</Card.Title>
          <Card.Description>
            Gene list for the report. This is not the sequencing kit.
          </Card.Description>
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
