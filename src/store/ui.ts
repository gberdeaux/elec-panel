import { create } from "zustand";

/** État d'interface partagé entre les pages (fenêtres ouvertes depuis plusieurs endroits). */
interface UiState {
  photoOpen: boolean;
  /** Tableau depuis lequel l'import a été lancé (proposé en remplacement). */
  photoTargetId?: string;
  openPhoto(targetId?: string): void;
  closePhoto(): void;
}

export const useUi = create<UiState>((set) => ({
  photoOpen: false,
  openPhoto: (targetId) => set({ photoOpen: true, photoTargetId: targetId }),
  closePhoto: () => set({ photoOpen: false, photoTargetId: undefined }),
}));
