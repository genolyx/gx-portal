'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { ordersApi } from '../../lib/api/orders';
import {
  isReportDownloaded,
  markReportDownloaded,
  reportDownloadKey,
} from '../../lib/report-downloads';

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

  const handlePress = () => {
    markReportDownloaded(orderId, dlKey);
    setDownloaded(true);
    window.open(ordersApi.getOutputFileUrl(orderId, filename), '_blank', 'noopener,noreferrer');
  };

  const btn = (
    <span title={filename}>
      <Button
        size={size === 'sm' ? 'sm' : 'md'}
        variant={downloaded ? 'primary' : 'secondary'}
        aria-label={typeof label === 'string' ? `${label}${downloaded ? ' (opened)' : ''}` : undefined}
        onPress={handlePress}
      >
        ↓ {label}
        {showFilename ? ` · ${filename}` : null}
      </Button>
    </span>
  );

  if (!stopRowClick) return btn;

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {btn}
    </span>
  );
}
