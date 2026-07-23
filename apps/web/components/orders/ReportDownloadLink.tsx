'use client';

import { useState } from 'react';
import { ordersApi } from '../../lib/api/orders';
import {
  isReportDownloaded,
  markReportDownloaded,
  reportDownloadKey,
} from '../../lib/report-downloads';
import { cn } from '../../lib/utils';

interface Props {
  orderId: string;
  filename: string;
  label: React.ReactNode;
  kind: 'pdf' | 'html';
  size?: 'sm' | 'md';
  showFilename?: boolean;
  stopRowClick?: boolean;
}

export function ReportDownloadLink({
  orderId,
  filename,
  label,
  kind,
  size = 'sm',
  showFilename = false,
  stopRowClick = false,
}: Props) {
  const dlKey = reportDownloadKey(filename);
  const [downloaded, setDownloaded] = useState(() => isReportDownloaded(orderId, dlKey));

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (stopRowClick) e.stopPropagation();
    markReportDownloaded(orderId, dlKey);
    setDownloaded(true);
  };

  const isPdf = kind === 'pdf';
  const compact = size === 'sm';

  return (
    <a
      href={ordersApi.getOutputFileUrl(orderId, filename)}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      title={filename}
      aria-label={typeof label === 'string' ? `${label}${downloaded ? ' (opened)' : ''}` : undefined}
      className={cn(
        'inline-flex items-center rounded-gx-sm border font-semibold transition-all select-none whitespace-nowrap',
        compact ? 'gap-1 px-2.5 py-1 text-[11px]' : 'gap-1.5 px-3 py-1.5 text-xs',
        isPdf
          ? downloaded
            ? 'bg-gx-danger/30 text-gx-danger border-gx-danger/70 ring-1 ring-gx-danger/40 shadow-gx-sm hover:bg-gx-danger/40'
            : 'bg-gx-danger/10 text-gx-danger border-gx-danger/30 hover:bg-gx-danger/20 hover:border-gx-danger/60 active:scale-95'
          : downloaded
            ? 'bg-gx-info/30 text-gx-info border-gx-info/70 ring-1 ring-gx-info/40 shadow-gx-sm hover:bg-gx-info/40'
            : 'bg-gx-info/10 text-gx-info border-gx-info/30 hover:bg-gx-info/20 hover:border-gx-info/60 active:scale-95',
      )}
    >
      <span className={compact ? 'text-[10px]' : undefined}>↓</span>
      <span>{label}</span>
      {showFilename && (
        <span className="text-[10px] opacity-60 font-normal">{filename}</span>
      )}
    </a>
  );
}
