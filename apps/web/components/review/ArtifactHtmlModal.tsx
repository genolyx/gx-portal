'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { reviewApi } from '../../lib/api/review';
import { stripFragileXFmr1BlockFromVisualReportHtml } from '../../lib/dark-genes';

export function ArtifactHtmlModal({
  open,
  orderId,
  relPath,
  title,
  help,
  stripFragileX,
  onClose,
}: {
  open: boolean;
  orderId: string;
  relPath: string | null;
  title: string;
  help?: string;
  stripFragileX?: boolean;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('Loading…');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    async function load() {
      setBlobUrl(null);
      setMsg('Loading…');
      if (!open || !orderId || !relPath) {
        setMsg('Missing order ID or file path.');
        return;
      }
      try {
        let html = await reviewApi.getArtifactText(orderId, relPath);
        if (stripFragileX) html = stripFragileXFmr1BlockFromVisualReportHtml(html);
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        revoked = url;
        setBlobUrl(url);
        setMsg('');
      } catch {
        if (!cancelled) {
          setMsg(
            'Could not load report. Ensure the pipeline produced this artifact and daemon file access is available.',
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, orderId, relPath, stripFragileX]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[20010] flex items-center justify-center bg-black/50 p-2"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[96vh] w-[min(98vw,1920px)] flex-col overflow-hidden rounded-xl border border-border bg-surface p-3.5 shadow-lg">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="m-0 text-[15px] font-bold">{title}</h3>
            {help && <p className="m-0 mt-1 text-[11px] leading-snug text-muted">{help}</p>}
          </div>
          <Button type="button" size="sm" variant="secondary" onPress={onClose}>
            Close
          </Button>
        </div>
        <div className="dg-smn-igv-host min-h-[min(78vh,920px)] flex-1 overflow-hidden rounded-xl border border-[#b0bec5] bg-[#eceff1] p-2.5">
          {blobUrl ? (
            <iframe title={title} className="dg-smn-igv-frame block h-[min(82vh,1000px)] min-h-[min(78vh,920px)] w-full rounded-lg border-0 bg-white" src={blobUrl} />
          ) : (
            <p className="m-0 p-3.5 text-[13px] leading-relaxed text-[#455a64]">{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function RepeatPlotsModal({
  open,
  orderId,
  relPaths,
  onClose,
}: {
  open: boolean;
  orderId: string;
  relPaths: string[];
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ rel: string; url: string }[]>([]);
  const [msg, setMsg] = useState('Loading repeat plots…');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const urls: string[] = [];
    let cancelled = false;

    async function load() {
      setItems([]);
      setMsg('Loading repeat plots…');
      if (!open) return;
      if (!relPaths.length) {
        setMsg('No repeat_svgs paths for this order. Reprocess or check pipeline visual_evidence.');
        return;
      }
      const next: { rel: string; url: string }[] = [];
      for (const rel of relPaths) {
        try {
          let blob = await reviewApi.getArtifactBlob(orderId, rel);
          if (/\.svg$/i.test(rel) || /svg/i.test(blob.type)) {
            blob = new Blob([await blob.arrayBuffer()], { type: 'image/svg+xml' });
          }
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          next.push({ rel, url });
        } catch {
          /* skip failed path */
        }
      }
      if (cancelled) return;
      setItems(next);
      setMsg(
        next.length
          ? ''
          : 'Could not load repeat SVGs. Check daemon file access to analysis paths.',
      );
    }

    void load();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [open, orderId, relPaths]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[20010] flex items-center justify-center bg-black/50 p-2"
      role="dialog"
      aria-modal="true"
      aria-label="Repeat expansion plots"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[96vh] w-[min(98vw,1920px)] overflow-auto rounded-xl border border-border bg-surface p-3.5 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="m-0 text-[15px] font-bold">Repeat expansion plots</h3>
          <Button type="button" size="sm" variant="secondary" onPress={onClose}>
            Close
          </Button>
        </div>
        <div className="rounded-xl border border-[#b0bec5] bg-[#eceff1] p-4 text-[#263238]">
          {msg ? (
            <p className="m-0 text-[13px] text-[#455a64]">{msg}</p>
          ) : (
            <>
              <div className="mb-3 text-[13px] font-semibold text-[#37474f]">Repeat expansion</div>
              {items.map((it) => (
                <div key={it.rel} className="mb-5 last:mb-0">
                  <div className="mb-2 font-mono text-[11px] text-[#546e7a]">{it.rel}</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt={it.rel}
                    className="block h-auto w-full max-w-full rounded-lg border border-[#cfd8dc] bg-white"
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
