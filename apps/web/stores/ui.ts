import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type FilesView = 'grid' | 'list';

export const SIDEBAR_MIN = 208;
export const SIDEBAR_MAX = 340;
export const SIDEBAR_DEFAULT = 244;

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  filesView: FilesView;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
  setMobileNavOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  setFilesView: (view: FilesView) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

// Mantiene il tema allineato al sistema quando theme === 'system'
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useUI.getState().theme === 'system') applyTheme('system');
  });
}

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_DEFAULT,
      mobileNavOpen: false,
      commandOpen: false,
      filesView: 'grid',
      setTheme(theme) {
        applyTheme(theme);
        set({ theme });
      },
      toggleSidebar() {
        set({ sidebarCollapsed: !get().sidebarCollapsed });
      },
      setSidebarWidth(w) {
        set({ sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w))) });
      },
      setMobileNavOpen(v) {
        set({ mobileNavOpen: v });
      },
      setCommandOpen(v) {
        set({ commandOpen: v });
      },
      setFilesView(view) {
        set({ filesView: view });
      },
    }),
    {
      name: 'bns-ui',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
        filesView: s.filesView,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);
