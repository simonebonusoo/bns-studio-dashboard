import { useEffect, useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { useTimer } from './timerStore';
import { useAuth } from '@/stores/auth';
import { useCreate } from '@/hooks/useEntities';
import { todayISO } from '@/lib/id';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import type { TimeEntry } from '@/types';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}

export function TimerWidget() {
  const timer = useTimer();
  const member = useAuth((s) => s.member);
  const createEntry = useCreate<TimeEntry>('timeEntries');
  const [, tick] = useState(0);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const active = timer.running || timer.accumulated > 0;

  const handleToggle = () => {
    if (!active) {
      if (!member) return;
      timer.start({ memberId: member.id, description: 'Sessione di lavoro' });
      toast.success('Timer avviato');
    } else if (timer.running) {
      timer.pause();
    } else {
      timer.resume();
    }
  };

  const handleStop = async () => {
    const ms = timer.elapsedMs();
    const minutes = Math.max(1, Math.round(ms / 60000));
    if (member) {
      await createEntry.mutateAsync({
        memberId: member.id,
        projectId: timer.projectId,
        taskId: timer.taskId,
        description: timer.description || 'Sessione manuale',
        date: todayISO(),
        startedAt: new Date(Date.now() - ms).toISOString(),
        durationMinutes: minutes,
        billable: true,
        hourlyRate: member.clientRate,
        internalCost: member.internalRate,
        approved: false,
        running: false,
      });
      toast.success(`Registrati ${minutes} minuti`);
    }
    timer.reset();
  };

  return (
    <div
      className={cn(
        'hidden items-center gap-1 rounded-lg border px-1.5 py-1 sm:flex',
        active ? 'border-accent/40 bg-accent/10' : 'border-border bg-surface',
      )}
    >
      <button onClick={handleToggle} className="press rounded p-1 text-fg hover:bg-surface-2" aria-label="Avvia o metti in pausa il timer">
        {timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className={cn('min-w-[58px] text-center font-mono text-xs tabular-nums', active ? 'text-fg' : 'text-fg-faint')}>
        {fmt(active ? timer.elapsedMs() : 0)}
      </span>
      {active && (
        <button onClick={handleStop} className="press rounded p-1 text-danger hover:bg-danger/10" aria-label="Ferma il timer e registra">
          <Square className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
