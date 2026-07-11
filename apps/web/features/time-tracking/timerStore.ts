import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  running: boolean;
  startedAt: number | null; // epoch ms
  accumulated: number; // ms accumulati prima dell'ultima pausa
  projectId: string | null;
  taskId: string | null;
  description: string;
  memberId: string | null;
  start: (opts: { projectId?: string; taskId?: string; description?: string; memberId: string }) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  elapsedMs: () => number;
}

export const useTimer = create<TimerState>()(
  persist(
    (set, get) => ({
      running: false,
      startedAt: null,
      accumulated: 0,
      projectId: null,
      taskId: null,
      description: '',
      memberId: null,

      start({ projectId, taskId, description, memberId }) {
        set({
          running: true,
          startedAt: Date.now(),
          accumulated: 0,
          projectId: projectId ?? null,
          taskId: taskId ?? null,
          description: description ?? '',
          memberId,
        });
      },
      pause() {
        const { startedAt, accumulated } = get();
        if (startedAt) set({ running: false, accumulated: accumulated + (Date.now() - startedAt), startedAt: null });
      },
      resume() {
        set({ running: true, startedAt: Date.now() });
      },
      reset() {
        set({ running: false, startedAt: null, accumulated: 0, projectId: null, taskId: null, description: '', memberId: null });
      },
      elapsedMs() {
        const { startedAt, accumulated, running } = get();
        return accumulated + (running && startedAt ? Date.now() - startedAt : 0);
      },
    }),
    { name: 'bns-timer' },
  ),
);
