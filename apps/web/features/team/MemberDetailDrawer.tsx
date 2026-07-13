import { useMemo, useState } from 'react';
import { Ban, Briefcase, Euro, Mail, Sparkles, Trash2 } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useDetail, useList, useUpdate, useRemove } from '@/hooks/useEntities';
import { useAuth } from '@/stores/auth';
import { ROLE_LABELS, ROLES } from '@/types/enums';
import { formatHours } from '@/lib/format';
import { memberAvatarProps } from '@/lib/memberAvatar';
import type { Member, Project, TimeEntry } from '@/types';
import { toast } from 'sonner';

export function MemberDetailDrawer({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const { data: member } = useDetail<Member>('members', memberId ?? undefined);
  const { data: projects } = useList<Project>('projects');
  const { data: entries } = useList<TimeEntry>('timeEntries');
  const update = useUpdate<Member>('members');
  const updateProject = useUpdate<Project>('projects');
  const remove = useRemove('members');
  const can = useAuth((s) => s.can);
  const [confirmDel, setConfirmDel] = useState(false);
  const [assignId, setAssignId] = useState('');

  const memberProjects = useMemo(
    () => (projects ?? []).filter((p) => p.memberIds.includes(memberId ?? '') || p.managerId === memberId),
    [projects, memberId],
  );
  const loggedMin = (entries ?? []).filter((e) => e.memberId === memberId && !e.running).reduce((s, e) => s + e.durationMinutes, 0);

  if (!member) return null;
  const canManage = can('team.manage');

  const patch = (p: Partial<Member>) => update.mutate({ id: member.id, patch: p });

  const capacityMin = member.weeklyHours * 60 * 4;
  const util = capacityMin ? Math.min(100, Math.round((loggedMin / capacityMin) * 100)) : 0;

  const assignToProject = async () => {
    if (!assignId) return;
    const p = (projects ?? []).find((x) => x.id === assignId);
    if (!p || p.memberIds.includes(member.id)) { toast.info('Già assegnato'); return; }
    await updateProject.mutateAsync({ id: p.id, patch: { memberIds: [...p.memberIds, member.id] } });
    toast.success(`Assegnato a ${p.name}`);
    setAssignId('');
  };

  const del = async () => {
    await remove.mutateAsync(member.id);
    toast.success('Membro rimosso');
    onClose();
  };

  return (
    <>
      <Drawer
        open={!!memberId}
        onClose={onClose}
        width="md"
        title={`${member.firstName} ${member.lastName}`}
        subtitle={member.jobTitle}
        footer={
          canManage ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4 text-danger" /> Rimuovi
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => patch({ status: member.status === 'suspended' ? 'active' : 'suspended' })}
              >
                <Ban className="h-4 w-4" /> {member.status === 'suspended' ? 'Riattiva' : 'Sospendi'}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar {...memberAvatarProps(member)} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="accent">{ROLE_LABELS[member.role]}</Badge>
                <StatusChip status={member.status} />
              </div>
              <a href={`mailto:${member.email}`} className="mt-2 flex items-center gap-1.5 truncate text-sm text-fg-subtle hover:text-fg">
                <Mail className="h-3.5 w-3.5" /> {member.email}
              </a>
            </div>
          </div>

          {/* Metriche essenziali */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Progetti" value={memberProjects.length} />
            <Stat label="Capacità" value={`${member.weeklyHours}h`} />
            <Stat label="Ore reg." value={formatHours(loggedMin)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InfoTile icon={<Euro className="h-4 w-4" />} label="Costo interno" value={`€${member.internalRate}/h`} />
            <InfoTile icon={<Euro className="h-4 w-4" />} label="Tariffa cliente" value={`€${member.clientRate}/h`} />
          </div>

          <div className="rounded-xl border border-border bg-surface-2/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-faint">
              <Sparkles className="h-3.5 w-3.5" /> Skill e collaborazione
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(member.skills ?? []).map((skill) => <Badge key={skill}>{skill}</Badge>)}
              {(member.skills ?? []).length === 0 && <span className="text-sm text-fg-subtle">Nessuna skill indicata</span>}
            </div>
            <p className="mt-3 text-sm text-fg-subtle">Contratto: <span className="font-medium text-fg">{COLLAB_LABELS[member.collaborationType] ?? member.collaborationType}</span></p>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs text-fg-subtle"><span>Workload (mese)</span><span>{util}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${util > 90 ? 'bg-danger' : util > 70 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${util}%` }} />
            </div>
          </div>

          {canManage && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-faint">Modifica</p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Nome"><Input defaultValue={member.firstName} onBlur={(e) => patch({ firstName: e.target.value })} /></F>
                <F label="Cognome"><Input defaultValue={member.lastName} onBlur={(e) => patch({ lastName: e.target.value })} /></F>
                <F label="Ruolo">
                  <Select value={member.role} onChange={(e) => patch({ role: e.target.value as Member['role'] })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </Select>
                </F>
                <F label="Disponibilità">
                  <Select value={member.status} onChange={(e) => patch({ status: e.target.value as Member['status'] })}>
                    <option value="active">Attivo</option>
                    <option value="unavailable">Non disponibile</option>
                    <option value="suspended">Sospeso</option>
                    <option value="inactive">Inattivo</option>
                  </Select>
                </F>
                <F label="Email"><Input type="email" defaultValue={member.email} onBlur={(e) => patch({ email: e.target.value })} /></F>
                <F label="Ore/settimana"><Input type="number" defaultValue={member.weeklyHours} onBlur={(e) => patch({ weeklyHours: Number(e.target.value) })} /></F>
                <F label="Costo interno €/h"><Input type="number" defaultValue={member.internalRate} onBlur={(e) => patch({ internalRate: Number(e.target.value) })} /></F>
                <F label="Tariffa cliente €/h"><Input type="number" defaultValue={member.clientRate} onBlur={(e) => patch({ clientRate: Number(e.target.value) })} /></F>
                <F label="Job title"><Input defaultValue={member.jobTitle} onBlur={(e) => patch({ jobTitle: e.target.value })} /></F>
                <F label="Collaborazione">
                  <Select value={member.collaborationType} onChange={(e) => patch({ collaborationType: e.target.value as Member['collaborationType'] })}>
                    {Object.entries(COLLAB_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                </F>
              </div>
              <F label="Skill (separate da virgola)">
                <Input defaultValue={(member.skills ?? []).join(', ')} onBlur={(e) => patch({ skills: e.target.value.split(',').map((skill) => skill.trim()).filter(Boolean) })} />
              </F>

              <F label="Assegna a progetto">
                <div className="flex gap-2">
                  <Select value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                    <option value="">Seleziona…</option>
                    {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                  <Button variant="secondary" size="sm" onClick={assignToProject}><Briefcase className="h-4 w-4" /></Button>
                </div>
              </F>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-faint">Progetti</p>
            <ul className="space-y-1">
              {memberProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md px-1 py-1 text-sm">
                  <span className="truncate">{p.name}</span>
                  <StatusChip status={p.status} />
                </li>
              ))}
              {memberProjects.length === 0 && <li className="text-sm text-fg-subtle">Nessun progetto</li>}
            </ul>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} title="Rimuovi membro" message={`Rimuovere ${member.firstName} ${member.lastName}?`} confirmLabel="Rimuovi" danger />
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 py-2.5">
      <p className="text-base font-bold">{value}</p>
      <p className="text-2xs text-fg-subtle">{label}</p>
    </div>
  );
}
function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <span className="text-fg-faint">{icon}</span>
      <div>
        <p className="text-2xs text-fg-subtle">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium text-fg-subtle">{label}</span>{children}</label>;
}
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = { active: 'Attivo', suspended: 'Sospeso', unavailable: 'Non disp.', inactive: 'Inattivo' };
  return <Badge tone={status === 'active' ? 'success' : status === 'suspended' ? 'danger' : 'neutral'}>{map[status] ?? status}</Badge>;
}

const COLLAB_LABELS: Record<Member['collaborationType'], string> = {
  founder: 'Founder',
  employee: 'Dipendente',
  freelance: 'Freelance',
  occasional: 'Occasionale',
  intern: 'Stage',
  consultant: 'Consulente',
  partner: 'Partner',
};
