import { create } from "zustand";

/**
 * Formulaire en cours d'édition avec des modifications non enregistrées.
 * La navigation consulte ce garde avant de quitter la page.
 */
interface DraftGuard {
  dirty: boolean;
  label?: string;
  save?: () => void;
  discard?: () => void;
  register(guard: { label: string; save: () => void; discard: () => void } | null): void;
  setDirty(dirty: boolean): void;
}

export const useDraftGuard = create<DraftGuard>((set) => ({
  dirty: false,
  register: (guard) => set(guard ? { ...guard } : { dirty: false, label: undefined, save: undefined, discard: undefined }),
  setDirty: (dirty) => set({ dirty }),
}));
