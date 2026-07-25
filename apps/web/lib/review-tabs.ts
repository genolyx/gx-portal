/** Review sub-tab ids — keep in sync with ReviewPageClient. */
export type ReviewTabId =
  | 'variants'
  | 'darkgenes'
  | 'pgx'
  | 'report'
  | 'genedb'
  | 'coverage';

export type ReviewOrderKind =
  | 'sgnipt'
  | 'pgx'
  | 'proactive'
  | 'carrier'
  | 'exome'
  | null;

export const REVIEW_TAB_IDS: ReviewTabId[] = [
  'variants',
  'darkgenes',
  'pgx',
  'report',
  'genedb',
  'coverage',
];

/** Flatten carrier nested fields onto order_params (legacy portal shape). */
export function carrierOrderMetaFlat(
  orderParams: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!orderParams || typeof orderParams !== 'object') return null;
  const c = orderParams.carrier;
  if (c && typeof c === 'object' && Object.keys(c as object).length) {
    return { ...orderParams, ...(c as Record<string, unknown>) };
  }
  return orderParams;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Resolve wes_panel_id from order_params and/or result filter_summary. */
export function resolveWesPanelId(rd: Record<string, unknown> | null | undefined): string {
  if (!rd || typeof rd !== 'object') return '';
  const op = (rd.order_params ?? null) as Record<string, unknown> | null;
  const flat = carrierOrderMetaFlat(op);
  const fromParams = str(
    (flat && flat.wes_panel_id != null ? flat.wes_panel_id : '') ||
      (((op && (op.carrier as Record<string, unknown> | undefined)) || {}).wes_panel_id ?? ''),
  );
  if (fromParams) return fromParams;
  // result.json often embeds the interpretation panel even when order_params is absent
  const fs = rd.filter_summary;
  if (fs && typeof fs === 'object') {
    return str((fs as Record<string, unknown>).wes_panel_id);
  }
  return '';
}

/**
 * Resolve review surface kind for an order.
 * Priority: sgnipt service → WES panel category → package/test fields → service_code.
 */
export function reviewOrderKind(
  rd: Record<string, unknown> | null | undefined,
  panelsById?: Record<string, { category?: string } | undefined>,
): ReviewOrderKind {
  if (!rd || typeof rd !== 'object') return null;

  const svc = str(rd._service_code ?? rd.service_code);
  if (svc === 'sgnipt') return 'sgnipt';
  // Heuristic: sgNIPT result.json often omits service_code but has clinical_findings + FF/panel
  if (
    Array.isArray(rd.clinical_findings) &&
    (rd.panel != null || rd.fetal_fraction_detail != null || rd.sgnipt_status != null)
  ) {
    return 'sgnipt';
  }

  const op = (rd.order_params ?? null) as Record<string, unknown> | null;
  const flat = carrierOrderMetaFlat(op);

  const wid = resolveWesPanelId(rd);
  const wp = wid && panelsById ? panelsById[wid] : null;
  const cat = str(wp?.category).toLowerCase();
  if (cat === 'pgx') return 'pgx';
  if (cat === 'proactive_health') return 'proactive';
  if (cat === 'carrier_screening') return 'carrier';
  // Label fallback when panel catalog is unavailable (e.g. "PGx Panel (45 genes)")
  const fs = rd.filter_summary;
  const panelLabel =
    fs && typeof fs === 'object'
      ? str((fs as Record<string, unknown>).wes_panel_label).toLowerCase()
      : '';
  if (panelLabel.includes('pgx') || panelLabel.includes('pharmacogen')) return 'pgx';
  if (panelLabel.includes('proactive')) return 'proactive';

  const pc = str(flat?.package_code);
  const tc = str(flat?.test_category);
  const ot = str(flat?.other_test_type);
  const pcU = pc.toUpperCase();

  if (pcU === 'PGX' || pc === 'pgx' || pc === 'Pharmacogenomics') return 'pgx';
  if (pc === 'WholeExome') return 'exome';
  if (pc === 'HealthScreening' || pc === 'Proactive') return 'proactive';
  if (
    tc === 'standard_carrier' ||
    (pc === 'CarrierScreening' && tc !== 'other') ||
    pc === 'CouplesCarrier' ||
    (tc === 'other' && ot === 'CouplesCarrier') ||
    pc === 'CarrierScreening'
  ) {
    return 'carrier';
  }

  if (svc === 'whole_exome') return 'exome';
  if (svc === 'health_screening') return 'proactive';
  if (svc === 'carrier_screening') return 'carrier';
  return null;
}

/** Which review subtabs to hide based on order kind. */
export function getReviewHiddenTabs(
  rd: Record<string, unknown> | null | undefined,
  panelsById?: Record<string, { category?: string } | undefined>,
): Set<ReviewTabId> {
  const hide = new Set<ReviewTabId>();
  const kind = reviewOrderKind(rd, panelsById);

  if (kind === 'sgnipt') {
    (['darkgenes', 'pgx'] as const).forEach((t) => hide.add(t));
  } else if (kind === 'pgx') {
    (['variants', 'coverage', 'darkgenes'] as const).forEach((t) => hide.add(t));
  } else if (kind === 'proactive') {
    hide.add('darkgenes');
  } else if (kind === 'carrier') {
    hide.add('pgx');
  } else if (kind == null) {
    // Conservative default for unknown carrier-like orders.
    hide.add('pgx');
  }
  return hide;
}

export function getVisibleReviewTabs(
  rd: Record<string, unknown> | null | undefined,
  panelsById?: Record<string, { category?: string } | undefined>,
): ReviewTabId[] {
  const hidden = getReviewHiddenTabs(rd, panelsById);
  return REVIEW_TAB_IDS.filter((t) => !hidden.has(t));
}
