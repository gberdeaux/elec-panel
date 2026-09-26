import { create } from "zustand";

/** État d'interface partagé entre les pages (fenêtres ouvertes depuis plusieurs endroits). */
export const useUi = create<{ photoOpen: boolean; openPhoto(): void; closePhoto(): void }>((set) => ({
  photoOpen: false,
  openPhoto: () => set({ photoOpen: true }),
  closePhoto: () => set({ photoOpen: false }),
}));
