import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Cartelle personalizzate del File Manager (demo: persistite in localStorage). */
interface FoldersState {
  folders: string[];
  add: (name: string) => void;
  remove: (name: string) => void;
  rename: (from: string, to: string) => void;
}

export const useFolders = create<FoldersState>()(
  persist(
    (set, get) => ({
      folders: ['Design', 'Documenti', 'Export'],
      add(name) {
        const n = name.trim();
        if (n && !get().folders.includes(n)) set({ folders: [...get().folders, n] });
      },
      remove(name) {
        set({ folders: get().folders.filter((f) => f !== name) });
      },
      rename(from, to) {
        const t = to.trim();
        if (!t) return;
        set({ folders: get().folders.map((f) => (f === from ? t : f)) });
      },
    }),
    { name: 'bns-folders' },
  ),
);
