'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { browseApi, type BrowseItem, type BrowseResponse } from '../../../lib/api/browse';
import { cn } from '../../../lib/utils';

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
    <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-full max-w-[640px]">
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-2.5">
              <div className="text-xs text-muted pb-2 border-b border-border">
                {crumbs.map((c, i) => (
                  <span key={c.rel || 'root'}>
                    {i > 0 && ' / '}
                    <button
                      type="button"
                      className="text-accent hover:underline bg-transparent border-0 p-0 cursor-pointer text-xs"
                      onClick={() => navigate(c.rel)}
                    >
                      {c.label}
                    </button>
                  </span>
                ))}
              </div>
              {data?.hint && <p className="text-xs text-muted m-0">{data.hint}</p>}
              {error && <p className="text-sm text-danger m-0">{error}</p>}
              {loading ? (
                <p className="text-sm text-muted m-0">Loading…</p>
              ) : (
                <div className="flex flex-col gap-0.5 max-h-[360px] overflow-y-auto">
                  {(relPath || absPath) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onPress={() => navigate(data?.parent_rel ?? '', data?.parent_abs)}
                    >
                      📁 .. (parent)
                    </Button>
                  )}
                  {(data?.items ?? []).filter((it) => it.kind === 'dir').map((it) => (
                    <Button
                      key={it.rel_path ?? it.abs_path ?? it.name}
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onPress={() => navigate(it.rel_path ?? '', it.abs_path)}
                    >
                      📁 {it.name}
                    </Button>
                  ))}
                  {files.map((it) => {
                    const sel = selected.includes(it.abs_path);
                    return (
                      <Button
                        key={it.abs_path}
                        variant={sel ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn('justify-start', sel && 'border border-border')}
                        onPress={() => toggleFile(it.abs_path)}
                      >
                        {sel ? '✓ ' : ''}📄 {it.name}
                      </Button>
                    );
                  })}
                  {!loading && (data?.items ?? []).length === 0 && files.length === 0 && (
                    <p className="text-sm text-muted m-0">No items here.</p>
                  )}
                </div>
              )}
              {mode === 'fastq-pair' && selected.length > 0 && (
                <p className="text-xs text-muted m-0">{selected.length}/2 file(s) selected</p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" isDisabled={selected.length === 0} onPress={apply}>
                {mode === 'fastq-pair' ? 'Apply R1 + R2' : 'Select file'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
