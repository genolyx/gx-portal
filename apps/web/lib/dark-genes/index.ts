export { escapeHtml, escapeAttr } from './escape';

export {
  extractSmacaSnpCtCounts,
  findSmacaSnpVariantDepthsFromReview,
  tryRenderSmacaCheckSection,
} from './smaca';
export type {
  SmacaSnpVariantDepthResult,
  SmacaVariant,
  SmacaReviewMeta,
  DarkGenesSection,
} from './smaca';

export {
  cftrEhIvs9RiskFromCounts,
  cftrEhSlashAllelesToInts,
  renderCftrIvs9EhBannerFromPayload,
  tryRenderCftrIvs9EhSection,
  darkGenesSectionIsCftrIvs9Relevant,
} from './cftr';
export type { CftrRisk, CftrIvs9EhPayload, CftrEhSectionOpts } from './cftr';

export {
  dosageAnalysisTitleMatches,
  alphaThalassemiaDosageTitleMatches,
  cyp21CahDosageTitleMatches,
  splitAlphaThalKvSegments,
  alphaThalPickScalar,
  alphaThalPickScalarAnywhere,
  alphaThalPickResultFromFormulaLine,
  normalizeCahHotspotToken,
  cyp21InferHotspotFromNmScreening,
  cyp21PickHotspotCall,
  cahParalogDeletionKvActionable,
  cahBodyImpliesHighPriority,
  tryRenderDosageAnalysisSection,
  tryRenderCahHotspotStandaloneSection,
} from './dosage';

export {
  darkGenesDisplayTitle,
  darkGenesSectionAlwaysOnCustomerPdf,
  darkGenesSectionExcludesLowRiskAutoApprove,
  isDarkGenesApoePgxSection,
  inferPipelineDangerForSection,
  padDarkGenesSectionReviews,
  darkGenesSectionVisualTarget,
  parseDarkGenesTsvToTableHtml,
  darkGenesRawDetails,
  normalizeDarkGenesSectionBody,
  parseDarkGenesDetailedToSections,
  stripFragileXFmr1BlockFromVisualReportHtml,
} from './sections';
export type {
  SectionReviewEntry,
  VisualEvidence,
  VisualTarget,
  ParsedSection,
} from './sections';
