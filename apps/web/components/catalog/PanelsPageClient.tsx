'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { catalogApi, type PanelPackage } from '../../lib/api/catalog';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import styles from './Catalog.module.css';

const CATEGORIES = [
  { value: 'carrier_screening', label: 'Carrier screening' },
  { value: 'proactive_health',  label: 'Proactive health' },
  { value: 'pgx',               label: 'Pharmacogenomics (PGx)' },
  { value: 'other',             label: 'Other' },
];

const emptyForm = () => ({
  id: '', label: '', category: 'carrier_screening', description: '',
  genes: '', interpretationGenesOnly: true,
});

export function PanelsPageClient() {
  const [panels,   setPanels]   = useState<PanelPackage[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');
  const [form,     setForm]     = useState(emptyForm());

  // Expandable gene list per panel
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [geneCache,   setGeneCache]   = useState<Record<string, string[]>>({});
  const [geneLoading, setGeneLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalogApi.getPanels();
      setPanels(res.panels ?? []);
    } catch { setPanels([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleGenes = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (geneCache[id]) return;           // already cached
    setGeneLoading(id);
    try {
      const full = await catalogApi.getPanel(id);
      const genes = Array.isArray(full.interpretation_genes)
        ? (full.interpretation_genes as string[])
        : [];
      setGeneCache((c) => ({ ...c, [id]: genes }));
    } catch {
      setGeneCache((c) => ({ ...c, [id]: [] }));
    } finally { setGeneLoading(null); }
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.label.trim()) { setSaveMsg('Package ID and Display name are required.'); return; }
    if (!/^[a-z0-9_-]+$/.test(form.id.trim())) { setSaveMsg('Package ID: lowercase letters, digits, _ or - only.'); return; }
    setSaving(true); setSaveMsg('');
    try {
      const body = {
        id: form.id.trim(),
        label: form.label.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        genes: form.genes.split(/[\n,]+/).map((g) => g.trim()).filter(Boolean),
        interpretation_genes_only: form.interpretationGenesOnly,
      };
      await catalogApi.savePanel(body);
      setSaveMsg('✓ Package saved');
      setForm(emptyForm());
      setGeneCache({});   // invalidate cache
      await load();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete panel "${id}"?`)) return;
    try { await catalogApi.deletePanel(id); setGeneCache((c) => { const n = { ...c }; delete n[id]; return n; }); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Delete failed'); }
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
    } catch { /* bundled panel — no gene list */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <PageHeader
        title="Panels"
        description="WES / exome panel packages — named gene lists for carrier order interpretation."
      />

      {/* ── Create / Update form ── */}
      <div className={styles.card} style={{ marginBottom: 20 }}>
        <h4 className={styles.cardTitle}>New or update package</h4>
        <div className={styles.formGrid}>
          <div>
            <label className={styles.label}>Package ID *</label>
            <input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="e.g. carrier_500_v1" className={styles.input} />
            <p className={styles.hint}>Lowercase letters, digits, <code>_</code> <code>-</code> only.</p>
          </div>
          <div>
            <label className={styles.label}>Display name *</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Carrier screening 500 genes" className={styles.input} />
          </div>
          <div>
            <label className={styles.label}>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={styles.input}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className={styles.label}>Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional — internal note" className={styles.input} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className={styles.label}>
              Gene list (one per line or comma-separated)
              {form.genes && <span className={styles.muted}> — {form.genes.split(/[\n,]+/).filter(Boolean).length} genes</span>}
            </label>
            <textarea
              value={form.genes}
              onChange={(e) => setForm({ ...form, genes: e.target.value })}
              rows={6}
              placeholder={'BRCA1\nCFTR\nSMN1'}
              className={styles.textarea}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.interpretationGenesOnly}
                onChange={(e) => setForm({ ...form, interpretationGenesOnly: e.target.checked })} />
              <span><strong>Gene list only</strong> (recommended) — saves symbols for post-analysis reporting. No extra files.</span>
            </label>
          </div>
        </div>
        <div className={styles.actionRow}>
          <Button size="sm" variant="primary" loading={saving} onClick={handleSave}>Save package</Button>
          <Button size="sm" variant="ghost" onClick={() => setForm(emptyForm())}>Reset</Button>
          {saveMsg && <span className={saveMsg.startsWith('✓') ? styles.ok : styles.err}>{saveMsg}</span>}
        </div>
      </div>

      {/* ── Saved packages ── */}
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h4 className={styles.cardTitle} style={{ margin: 0 }}>Saved packages</h4>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>↻ Refresh</Button>
        </div>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : panels.length === 0 ? (
          <p className={styles.muted}>No panel packages saved.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Genes</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {panels.map((p) => {
                  const isOpen  = expanded === p.id;
                  const isLoading = geneLoading === p.id;
                  const genes   = geneCache[p.id] ?? [];
                  return (
                    <Fragment key={p.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => handleToggleGenes(p.id)}>
                        <td style={{ width: 24, color: 'var(--text-muted)', fontSize: 11 }}>
                          {isLoading ? '…' : isOpen ? '▾' : '▸'}
                        </td>
                        <td style={{ fontWeight: 500 }}>{p.label}</td>
                        <td className={styles.mono}>{p.id}</td>
                        <td className={styles.muted}>{p.category ?? '—'}</td>
                        <td className={styles.mono} style={{ textAlign: 'right' }}>
                          {isOpen && genes.length > 0 ? genes.length : (p.gene_count ?? '—')}
                        </td>
                        <td className={styles.muted}>{p.source ?? '—'}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} style={{ padding: '8px 16px 16px 40px', background: 'var(--bg-elevated)' }}>
                            {isLoading ? (
                              <span className={styles.muted}>Loading gene list…</span>
                            ) : genes.length === 0 ? (
                              <span className={styles.muted}>No gene list found for this panel.</span>
                            ) : (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                  {genes.length} interpretation genes
                                  {p.description && <span style={{ marginLeft: 12, fontStyle: 'italic' }}>{p.description}</span>}
                                </div>
                                <div style={{
                                  display: 'flex', flexWrap: 'wrap', gap: '3px 6px',
                                  maxHeight: 160, overflowY: 'auto',
                                  padding: '8px', background: 'var(--bg-surface)',
                                  borderRadius: 4, border: '1px solid var(--border)',
                                }}>
                                  {genes.map((g) => (
                                    <span key={g} style={{
                                      fontSize: 11, fontFamily: 'monospace',
                                      background: 'var(--bg-elevated)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 3, padding: '1px 5px',
                                      color: 'var(--text-secondary)',
                                    }}>{g}</span>
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
      </div>
    </div>
  );
}
