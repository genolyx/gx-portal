import { create } from 'zustand';
import type { ReviewData, Variant, AcmgClass } from '@gx-portal/types';

export interface VariantComment {
  classification?: AcmgClass;
  comment?: string;
}

export type CoverageNavRequest = {
  /** e.g. CFTR IVS9 locus */
  locus: string;
  label?: string;
};

interface ReviewStore {
  reviewData: ReviewData | null;
  selectedVariants: Set<string>;
  variantComments: Record<string, VariantComment>;
  /** One-shot request from Dark genes → Coverage tab */
  coverageNav: CoverageNavRequest | null;

  setReviewData: (data: ReviewData) => void;
  /** One Zustand commit — avoids double full-table re-render on sgNIPT load. */
  setReviewDataAndSelection: (data: ReviewData, selectedIds: string[]) => void;
  patchReviewData: (patch: Partial<ReviewData>) => void;
  toggleVariant: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setVariantComment: (id: string, comment: Partial<VariantComment>) => void;
  requestCoverageNav: (nav: CoverageNavRequest) => void;
  clearCoverageNav: () => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  reviewData: null,
  selectedVariants: new Set(),
  variantComments: {},
  coverageNav: null,

  setReviewData: (data) => set({ reviewData: data }),
  setReviewDataAndSelection: (data, selectedIds) =>
    set({ reviewData: data, selectedVariants: new Set(selectedIds) }),
  patchReviewData: (patch) =>
    set((s) => (s.reviewData ? { reviewData: { ...s.reviewData, ...patch } } : {})),

  toggleVariant: (id) =>
    set((s) => {
      const next = new Set(s.selectedVariants);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { selectedVariants: next };
    }),

  selectAll: (ids) => set({ selectedVariants: new Set(ids) }),
  clearSelection: () => set({ selectedVariants: new Set() }),

  setVariantComment: (id, comment) =>
    set((s) => ({
      variantComments: {
        ...s.variantComments,
        [id]: { ...s.variantComments[id], ...comment },
      },
    })),

  requestCoverageNav: (nav) => set({ coverageNav: nav }),
  clearCoverageNav: () => set({ coverageNav: null }),

  reset: () =>
    set({
      reviewData: null,
      selectedVariants: new Set(),
      variantComments: {},
      coverageNav: null,
    }),
}));
