'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Label } from '@heroui/react';
import { Trash2, Upload } from 'lucide-react';
import { catalogApi, type VariantSet, type VariantSetEntry } from '../../lib/api/catalog';
import { formatPortalDateTime } from '../../lib/datetime';
import { FilePickerButton } from '../ui/FilePickerButton';
import { PageHeader } from '../ui/PageHeader';
import { RefreshButton } from '../ui/RefreshButton';

export function VariantSetsPageClient() {
  const [sets, setSets] = useState<VariantSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tagName, setTagName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [entries, setEntries] = useState<Record<number, VariantSetEntry[] | 'loading' | 'error'>>(
    {},
  );

  const load = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const res = await catalogApi.getVariantSets();
      setSets(res.sets ?? []);
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
    } catch (e) {
      setSets([]);
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh variant sets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || !file) {
      setUploadMsg('Tag name and file are required.');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('tag_name', tagName.trim());
      fd.append('file', file);
      const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
      const res = await fetch(`${base}/variant-sets`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setUploadMsg('✓ Uploaded successfully');
      setTagName('');
      setFile(null);
      await load();
    } catch (err) {
      setUploadMsg(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, tag: string) => {
    if (!confirm(`Delete variant set "${tag}"?`)) return;
    try {
      await catalogApi.deleteVariantSet(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const toggleExpand = async (id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        return n;
      }
      n.add(id);
      return n;
    });
    if (!entries[id]) {
      setEntries((prev) => ({ ...prev, [id]: 'loading' }));
      try {
        const res = await catalogApi.getVariantSetEntries(id);
        let list: VariantSetEntry[] = [];
        if (Array.isArray(res)) {
          list = res as VariantSetEntry[];
        } else if (res && typeof res === 'object') {
          const r = res as unknown as Record<string, unknown>;
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
      <PageHeader
        title="Variant Sets"
        description="Upload TSV lists and tag matching variants in Review."
      />

      <Card className="mb-5">
        <Card.Header>
          <Card.Title>Upload / Replace a Variant Set</Card.Title>
          <Card.Description>
            Required columns: <code>chrom</code>, <code>pos</code>, <code>ref</code>,{' '}
            <code>alt</code>. Optional: <code>gene</code>, <code>label</code>. Lines starting with{' '}
            <code>#</code> are ignored.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form
            onSubmit={handleUpload}
            className="flex flex-wrap gap-3 items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label>Tag name *</Label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. Hotspot"
                className="min-w-[180px]"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>TSV file *</Label>
              <FilePickerButton
                accept=".tsv,.txt,.csv"
                file={file}
                onChange={setFile}
                label="Choose TSV file"
                disabled={uploading}
                aria-label="Choose TSV file"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isDisabled={uploading || !file}
              className="gap-1.5"
            >
              <Upload size={14} strokeWidth={2} aria-hidden />
              {uploading ? 'Uploading…' : 'Upload / Replace'}
            </Button>
            {uploadMsg && (
              <span
                className={
                  uploadMsg.startsWith('✓') ? 'text-sm text-success' : 'text-sm text-danger'
                }
              >
                {uploadMsg}
              </span>
            )}
          </form>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Card.Title>Saved Variant Sets</Card.Title>
            <RefreshButton
              variant="ghost"
              label="Refresh"
              successToast="Variant sets refreshed"
              isLoading={loading}
              onPress={() => load(true)}
            />
          </div>
        </Card.Header>
        <Card.Content>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : sets.length === 0 ? (
            <p className="text-muted">No variant sets found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-left text-muted">
                  <tr>
                    <th className="p-2">Tag</th>
                    <th className="p-2">Variants</th>
                    <th className="p-2">Updated</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((s) => {
                    const isExpanded = expanded.has(s.id);
                    const setEntryData = entries[s.id];
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          className={`border-t border-border ${isExpanded ? 'bg-surface-secondary/50' : ''}`}
                        >
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-auto min-h-0 p-0 font-medium"
                              onPress={() => toggleExpand(s.id)}
                            >
                              {isExpanded ? '▼ ' : '▶ '}
                              {s.tag_name}
                            </Button>
                          </td>
                          <td className="p-2 font-mono">{s.entry_count.toLocaleString()}</td>
                          <td className="p-2 text-muted">
                            {s.updated_at ? formatPortalDateTime(s.updated_at) : '—'}
                          </td>
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="danger"
                              isIconOnly
                              aria-label={`Delete ${s.tag_name}`}
                              onPress={() => handleDelete(s.id, s.tag_name)}
                            >
                              <Trash2 size={15} strokeWidth={2} aria-hidden />
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-border bg-surface-secondary">
                            <td colSpan={4} className="p-3">
                              {setEntryData === 'loading' ? (
                                <p className="text-muted py-2">Loading entries…</p>
                              ) : setEntryData === 'error' ? (
                                <p className="text-danger py-2">Failed to load entries.</p>
                              ) : Array.isArray(setEntryData) && setEntryData.length > 0 ? (
                                <>
                                  <p className="text-xs text-muted mb-2">
                                    <strong>{s.tag_name}</strong> —{' '}
                                    {setEntryData.length.toLocaleString()} variants
                                  </p>
                                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                                    <table className="w-full text-xs">
                                      <thead className="bg-surface text-muted">
                                        <tr>
                                          <th className="p-2 text-left">LOCUS</th>
                                          <th className="p-2 text-left">ALLELE</th>
                                          <th className="p-2 text-left">GENE</th>
                                          <th className="p-2 text-left">LABEL</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {setEntryData.map((e, i) => (
                                          <tr key={i} className="border-t border-border">
                                            <td className="p-2 font-mono">
                                              {e.chrom}:{e.pos}
                                            </td>
                                            <td className="p-2 font-mono">
                                              {e.ref} → {e.alt}
                                            </td>
                                            <td className="p-2">{e.gene ?? '—'}</td>
                                            <td className="p-2 text-muted">{e.label ?? '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </>
                              ) : (
                                <p className="text-muted py-2">No entries found for this set.</p>
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
        </Card.Content>
      </Card>
    </div>
  );
}
