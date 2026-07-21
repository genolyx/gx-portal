import { create } from 'zustand';
import type { ReviewData, Variant, AcmgClass } from '@gx-portal/types';

export interface VariantComment {
  classification?: AcmgClass;
  comment?: string;
}

interface ReviewStore {
  reviewData: ReviewData | null;
  selectedVariants: Set<string>;
  variantComments: Record<string, VariantComment>;

  setReviewData: (data: ReviewData) => void;
  toggleVariant: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setVariantComment: (id: string, comment: Partial<VariantComment>) => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  reviewData: null,
  selectedVariants: new Set(),
  variantComments: {},

  setReviewData: (data) => set({ reviewData: data }),

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

  reset: () => set({ reviewData: null, selectedVariants: new Set(), variantComments: {} }),
}));
