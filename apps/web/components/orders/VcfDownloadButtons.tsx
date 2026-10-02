'use client';

import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { ordersApi } from '../../lib/api/orders';
import { orderArtifactUrl } from '../../lib/api/review';

interface VcfFile {
  name: string;
  rel_path: string;
  size: number;
}

interface Props {
  orderId: string;
  stopRowClick?: boolean;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function startDownload(orderId: string, file: VcfFile) {
  const a = document.createElement('a');
  a.href = orderArtifactUrl(orderId, file.rel_path);
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function VcfDownloadButtons({ orderId, stopRowClick = false }: Props) {
  const [vcf, setVcf] = useState<VcfFile | null | undefined>(undefined);
  const [annotated, setAnnotated] = useState<VcfFile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getVcfDownloads(orderId)
      .then((res) => {
        if (cancelled) return;
        setVcf(res.vcf);
        setAnnotated(res.annotated_vcf);
      })
      .catch(() => {
        if (cancelled) return;
        setVcf(null);
        setAnnotated(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const waiting = vcf === undefined || annotated === undefined;

  const buttons = (
    <div className="flex flex-wrap gap-1.5">
      <span title={vcf?.name}>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={waiting || !vcf}
          onPress={() => {
            if (vcf) startDownload(orderId, vcf);
          }}
        >
          ↓ VCF{vcf ? ` · ${formatBytes(vcf.size)}` : ''}
        </Button>
      </span>
      <span title={annotated?.name}>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={waiting || !annotated}
          onPress={() => {
            if (annotated) startDownload(orderId, annotated);
          }}
        >
          ↓ Annotated VCF{annotated ? ` · ${formatBytes(annotated.size)}` : ''}
        </Button>
      </span>
    </div>
  );

  if (!stopRowClick) return buttons;

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {buttons}
    </span>
  );
}
