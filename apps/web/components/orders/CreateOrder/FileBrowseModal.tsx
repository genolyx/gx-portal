'use client';

import { useCallback, useEffect, useState } from 'react';
import { browseApi, type BrowseItem, type BrowseResponse } from '../../../lib/api/browse';
import { Button } from '../../ui/Button';
import styles from './CreateOrder.module.css';

type BrowseMode = 'fastq-pair' | 'file';

interface Props {
  mode: BrowseMode;
  title: string;
  serviceCode: string;
  fileExt?: 'csv' | 'bam';
  onClose: () => void;
  onSelect: (paths: string[]) => void;
}

export function FileBrowseModal({ mode, title, serviceCode, fileExt, onClose, onSelect }: Props) {
  const [relPath, setRelPath]     = useState('');
  const [absPath, setAbsPath]     = useState<string | undefined>();
  const [data, setData]           = useState<BrowseResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState<string[]>([]);

  const load = useCallback(async (rel: string, abs?: string) => {
    setLoading(true); setError('');
    try {
      const res = mode === 'fastq-pair'
        ? await browseApi.fastq(rel, serviceCode)
        : await browseApi.bamCsv({ path: rel, service_code: serviceCode, abs_path: abs, file_ext: fileExt });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Browse failed');
      setData(null);
    } finally { setLoading(false); }
  }, [mode, serviceCode, fileExt]);

  useEffect(() => { load(relPath, absPath); }, [load, relPath, absPath]);

  const navigate = (rel: string, abs?: string) => {
    setRelPath(rel);
    setAbsPath(abs);
    setSelected([]);
  };

  const files = (data?.items ?? []).filter((it): it is BrowseItem & { abs_path: string } =>
    it.kind === 'file' && !!it.abs_path);

  const toggleFile = (abs: string) => {
    if (mode === 'file') {
      setSelected([abs]);
      return;
    }
    setSelected((prev) => {
      if (prev.includes(abs)) return prev.filter((p) => p !== abs);
      if (prev.length >= 2) return [prev[1], abs];
      return [...prev, abs];
    });
  };

  const apply = () => {
    if (selected.length === 0) return;
    onSelect(selected);
    onClose();
  };

  const crumbs: { label: string; rel: string; abs?: string }[] = [{ label: '[root]', rel: '' }];
  if (data?.rel_path) {
    let acc = '';
    for (const p of data.rel_path.split('/').filter(Boolean)) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({ label: p, rel: acc });
    }
  }

  return (
    <div className={styles.browseOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.browseModal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.browseBody}>
          <div className={styles.breadcrumb}>
            {crumbs.map((c, i) => (
              <span key={c.rel || 'root'}>
                {i > 0 && ' / '}
                <button type="button" className={styles.crumbLink} onClick={() => navigate(c.rel)}>{c.label}</button>
              </span>
            ))}
          </div>
          {data?.hint && <p className={styles.browseHint}>{data.hint}</p>}
          {error && <p className={styles.error}>{error}</p>}
          {loading ? (
            <p className={styles.hint}>Loading…</p>
          ) : (
            <div className={styles.browseList}>
              {(relPath || absPath) && (
                <button type="button" className={styles.browseRow}
                  onClick={() => navigate(data?.parent_rel ?? '', data?.parent_abs)}>
                  📁 .. (parent)
                </button>
              )}
              {(data?.items ?? []).filter((it) => it.kind === 'dir').map((it) => (
                <button key={it.rel_path ?? it.abs_path ?? it.name} type="button" className={styles.browseRow}
                  onClick={() => navigate(it.rel_path ?? '', it.abs_path)}>
                  📁 {it.name}
                </button>
              ))}
              {files.map((it) => {
                const sel = selected.includes(it.abs_path);
                return (
                  <button key={it.abs_path} type="button"
                    className={`${styles.browseRow} ${sel ? styles.browseRowSelected : ''}`}
                    onClick={() => toggleFile(it.abs_path)}>
                    {sel ? '✓ ' : ''}📄 {it.name}
                  </button>
                );
              })}
              {!loading && (data?.items ?? []).length === 0 && files.length === 0 && (
                <p className={styles.hint}>No items here.</p>
              )}
            </div>
          )}
          {mode === 'fastq-pair' && selected.length > 0 && (
            <p className={styles.hint}>{selected.length}/2 file(s) selected</p>
          )}
        </div>
        <div className={styles.modalFooter}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" disabled={selected.length === 0} onClick={apply}>
            {mode === 'fastq-pair' ? 'Apply R1 + R2' : 'Select file'}
          </Button>
        </div>
      </div>
    </div>
  );
}
