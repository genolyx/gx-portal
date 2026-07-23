'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { catalogApi, type VariantSet, type VariantSetEntry } from '../../lib/api/catalog';
import { formatPortalDateTime } from '../../lib/datetime';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import styles from './Catalog.module.css';

export function VariantSetsPageClient() {
  const [sets, setSets]     = useState<VariantSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tagName, setTagName]   = useState('');
  const [file, setFile]         = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [entries, setEntries] = useState<Record<number, VariantSetEntry[] | 'loading' | 'error'>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalogApi.getVariantSets();
      setSets(res.sets ?? []);
      // If the daemon returns entries_by_tag in the list response, preload them
      if (res.entries_by_tag && typeof res.entries_by_tag === 'object') {
        const byTag = res.entries_by_tag as Record<string, VariantSetEntry[]>;
        setEntries((prev) => {
          const next = { ...prev };
          (res.sets ?? []).forEach((s) => {
            if (byTag[s.tag_name]) next[s.id] = byTag[s.tag_name];
          });
          return next;
        });
      }
    } catch { setSets([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || !file) { setUploadMsg('Tag name and file are required.'); return; }
    setUploading(true); setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('tag_name', tagName.trim());
      fd.append('file', file);
      const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
      const res = await fetch(`${base}/variant-sets`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setUploadMsg('✓ Uploaded successfully');
      setTagName(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setUploadMsg(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: number, tag: string) => {
    if (!confirm(`Delete variant set "${tag}"?`)) return;
    try { await catalogApi.deleteVariantSet(id); await load(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const toggleExpand = async (id: number) => {
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); return n; } n.add(id); return n; });
    // If entries not yet loaded, fetch now
    if (!entries[id]) {
      setEntries((prev) => ({ ...prev, [id]: 'loading' }));
      try {
        const res = await catalogApi.getVariantSetEntries(id);
        // Response shape: { entries: [...] } or { variants: [...] } or array at root
        let list: VariantSetEntry[] = [];
        if (Array.isArray(res)) {
          list = res as VariantSetEntry[];
        } else if (res && typeof res === 'object') {
          const r = res as Record<string, unknown>;
          list = (r.entries ?? r.variants ?? r.items ?? []) as VariantSetEntry[];
        }
        setEntries((prev) => ({ ...prev, [id]: list }));
      } catch {
        setEntries((prev) => ({ ...prev, [id]: 'error' }));
      }
    }
  };

  return (
    <div>
      <PageHeader title="Variant Sets" description="Upload TSV lists and tag matching variants in Review." />

      <div className={styles.card} style={{ marginBottom: 20 }}>
        <h4 className={styles.cardTitle}>Upload / Replace a Variant Set</h4>
        <p className={styles.hint}>Required columns: <code>chrom</code>, <code>pos</code>, <code>ref</code>, <code>alt</code>. Optional: <code>gene</code>, <code>label</code>. Lines starting with <code>#</code> are ignored.</p>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
          <div>
            <label className={styles.label}>Tag name *</label>
            <input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="e.g. Hotspot" className={styles.input} style={{ minWidth: 180 }} required />
          </div>
          <div>
            <label className={styles.label}>TSV file *</label>
            <input ref={fileRef} type="file" accept=".tsv,.txt,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={styles.input} required />
          </div>
          <Button type="submit" size="sm" variant="primary" loading={uploading}>Upload / Replace</Button>
          {uploadMsg && <span className={uploadMsg.startsWith('✓') ? styles.ok : styles.err}>{uploadMsg}</span>}
        </form>
      </div>

      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h4 className={styles.cardTitle} style={{ margin: 0 }}>Saved Variant Sets</h4>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>↻ Refresh</Button>
        </div>
        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : sets.length === 0 ? (
          <p className={styles.muted}>No variant sets found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Tag</th><th>Variants</th><th>Updated</th><th></th></tr></thead>
              <tbody>
                {sets.map((s) => {
                  const isExpanded = expanded.has(s.id);
                  const setEntryData = entries[s.id];
                  return (
                    <React.Fragment key={s.id}>
                      <tr className={isExpanded ? styles.rowExpanded : ''}>
                        <td>
                          <button type="button" className={styles.tagBtn} onClick={() => toggleExpand(s.id)}>
                            {isExpanded ? '▼ ' : '▶ '}{s.tag_name}
                          </button>
                        </td>
                        <td className={styles.mono}>{s.entry_count.toLocaleString()}</td>
                        <td className={styles.muted}>{s.updated_at ? formatPortalDateTime(s.updated_at) : '—'}</td>
                        <td>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id, s.tag_name)}>Delete</Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`exp-${s.id}`}>
                          <td colSpan={4} className={styles.expandCell}>
                            {setEntryData === 'loading' ? (
                              <p className={styles.muted} style={{ padding: '8px 0' }}>Loading entries…</p>
                            ) : setEntryData === 'error' ? (
                              <p className={styles.err} style={{ padding: '8px 0' }}>Failed to load entries.</p>
                            ) : Array.isArray(setEntryData) && setEntryData.length > 0 ? (
                              <>
                                <p className={styles.hint} style={{ marginBottom: 8 }}>
                                  <strong>{s.tag_name}</strong> — {setEntryData.length.toLocaleString()} variants
                                </p>
                                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                  <table className={styles.table} style={{ fontSize: '0.82em' }}>
                                    <thead>
                                      <tr>
                                        <th>LOCUS</th>
                                        <th>ALLELE</th>
                                        <th>GENE</th>
                                        <th>LABEL</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {setEntryData.map((e, i) => (
                                        <tr key={i}>
                                          <td className={styles.mono}>{e.chrom}:{e.pos}</td>
                                          <td className={styles.mono}>{e.ref} → {e.alt}</td>
                                          <td>{e.gene ?? '—'}</td>
                                          <td className={styles.muted}>{e.label ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <p className={styles.muted} style={{ padding: '8px 0' }}>No entries found for this set.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
