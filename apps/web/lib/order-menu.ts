import type { Order } from '@gx-portal/types';

export const PIPELINE_SERVICES = [
  'carrier_screening',
  'whole_exome',
  'health_screening',
  'sgnipt',
] as const;

export type PipelineService = (typeof PIPELINE_SERVICES)[number];

export type OrderMenuAction =
  | 'edit'
  | 'review'
  | 'new-from'
  | 'submit'
  | 'force-run'
  | 'force-run-fresh'
  | 'reprocess-only'
  | 'stop'
  | 'delete'
  | 'purge-db';

export interface OrderMenuItem {
  action: OrderMenuAction;
  label: string;
  danger?: boolean;
  title?: string;
}

export function orderStatusUpper(order: Order): string {
  return String(order.status ?? '').toUpperCase();
}

export function isPipelineService(serviceCode: string): serviceCode is PipelineService {
  return (PIPELINE_SERVICES as readonly string[]).includes(serviceCode);
}

/** Match service-daemon/Portal order list ⋯ menu visibility. */
export function buildOrderMenuItems(order: Order): OrderMenuItem[] {
  const st = orderStatusUpper(order);
  const svc = order.service_code;
  const pipeline = isPipelineService(svc);
  const items: OrderMenuItem[] = [];

  items.push({ action: 'edit', label: 'Edit' });

  if ((st === 'COMPLETED' || st === 'REPORT_READY') && pipeline) {
    items.push({ action: 'review', label: 'Review' });
    items.push({
      action: 'new-from',
      label: 'New order from this…',
      title: 'New draft with copied clinical fields and FASTQ/BAM paths; enter a new Order ID',
    });
  }

  if (pipeline && ['COMPLETED', 'REPORT_READY', 'FAILED', 'CANCELLED'].includes(st)) {
    const forceTitle =
      svc === 'sgnipt'
        ? 'Full pipeline from FASTQ (Nextflow -resume: cache reused)'
        : 'Full pipeline from FASTQ (alignment + calling + post-process; -resume)';
    items.push({ action: 'force-run', label: 'Force Run', title: forceTitle });
    items.push({
      action: 'force-run-fresh',
      label: 'Force Run (Fresh)',
      title: 'Delete Nextflow work/ cache and run completely from scratch (--fresh)',
    });
  }

  if (pipeline && ['COMPLETED', 'REPORT_READY', 'FAILED'].includes(st)) {
    const reprocessTitle =
      svc === 'sgnipt'
        ? 'Regenerate result.json from existing pipeline output; skip re-running the pipeline'
        : 'Refresh result.json and QC from existing VCFs; skip Nextflow';
    items.push({ action: 'reprocess-only', label: 'Reprocess only', title: reprocessTitle });
  }

  const terminalMenu = ['SAVED', 'FAILED', 'CANCELLED', 'COMPLETED', 'REPORT_READY'].includes(st);
  if (terminalMenu) {
    const skipSubmit = pipeline && ['COMPLETED', 'REPORT_READY', 'FAILED', 'CANCELLED'].includes(st);
    if (!skipSubmit) {
      items.push({ action: 'submit', label: 'Submit' });
    }
  }

  const stoppable = ['SAVED', 'QUEUED', 'RUNNING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING', 'RECEIVED'];
  if (stoppable.includes(st)) {
    items.push({ action: 'stop', label: 'Stop', danger: true });
  }

  const deleteBlocked = ['RUNNING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING', 'RECEIVED'];
  if (!deleteBlocked.includes(st)) {
    items.push({ action: 'delete', label: 'Delete', danger: true });
    items.push({
      action: 'purge-db',
      label: 'Purge DB',
      danger: true,
      title: 'Remove SQLite row only; leaves analysis/output/log on disk',
    });
  }

  return items;
}

export function canEditOrderService(serviceCode: string): boolean {
  return isPipelineService(serviceCode);
}
