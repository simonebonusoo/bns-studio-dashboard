import { useEffect, useRef, useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { ROLE_LABELS } from '@/types/enums';
import { useAuth } from '@/stores/auth';
import { updateOwnProfile, uploadOwnAvatar } from '@/services/profileService';
import { memberAvatarProps } from '@/lib/memberAvatar';
import type { Member } from '@/types';
import { toast } from 'sonner';

function formFromMember(member: Member) {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: member.displayName ?? `${member.firstName} ${member.lastName}`,
    phone: member.phone ?? '',
    jobTitle: member.jobTitle ?? '',
    bio: member.bio ?? '',
    skills: (member.skills ?? []).join(', '),
    status: member.status,
  };
}

export default function ProfilePage() {
  const member = useAuth((state) => state.member);
  const refresh = useAuth((state) => state.refresh);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [form, setForm] = useState(() => (member ? formFromMember(member) : null));

  useEffect(() => {
    if (member) setForm(formFromMember(member));
  }, [member]);

  if (!member || !form) return null;

  const fullName = `${member.firstName} ${member.lastName}`;
  const shownName = member.displayName || fullName;

  const set = (key: keyof typeof form, value: string) => setForm((current) => current ? { ...current, [key]: value } : current);

  const save = async () => {
    setSaving(true);
    try {
      await updateOwnProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        displayName: form.displayName.trim(),
        phone: form.phone.trim() || null,
        jobTitle: form.jobTitle.trim(),
        bio: form.bio.trim() || null,
        skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        status: form.status as Member['status'],
      });
      await refresh();
      toast.success('Profilo aggiornato');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    setAvatarSaving(true);
    try {
      await uploadOwnAvatar(file);
      await refresh();
      toast.success('Avatar aggiornato');
    } finally {
      setAvatarSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            className="group relative rounded-full"
            onClick={() => fileRef.current?.click()}
            aria-label="Carica avatar"
          >
            <Avatar {...memberAvatarProps(member)} name={shownName} size="lg" className="h-16 w-16 text-xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void uploadAvatar(event.target.files?.[0])}
          />
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-fg">{shownName}</h1>
            <p className="mt-1 text-sm text-fg-subtle">{member.jobTitle || 'Nessun job title impostato'}</p>
            <p className="mt-0.5 text-sm text-fg-faint">{member.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{ROLE_LABELS[member.role]}</Badge>
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Modifica profilo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Informazioni account" subtitle="Gestisci i dati personali usati dentro BnsStudio." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={form.firstName} onChange={(event) => set('firstName', event.target.value)} />
          </Field>
          <Field label="Cognome">
            <Input value={form.lastName} onChange={(event) => set('lastName', event.target.value)} />
          </Field>
          <Field label="Display name">
            <Input value={form.displayName} onChange={(event) => set('displayName', event.target.value)} />
          </Field>
          <Field label="Telefono">
            <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
          </Field>
          <Field label="Job title">
            <Input value={form.jobTitle} onChange={(event) => set('jobTitle', event.target.value)} />
          </Field>
          <Field label="Disponibilità">
            <Select value={form.status} onChange={(event) => set('status', event.target.value)}>
              <option value="active">Attivo</option>
              <option value="unavailable">Non disponibile</option>
              <option value="inactive">Inattivo</option>
            </Select>
          </Field>
          <Field label="Competenze" className="sm:col-span-2">
            <Input value={form.skills} onChange={(event) => set('skills', event.target.value)} placeholder="Design, React, SEO" />
          </Field>
          <Field label="Bio interna" className="sm:col-span-2">
            <Textarea value={form.bio} onChange={(event) => set('bio', event.target.value)} placeholder="Note interne sul tuo ruolo nello studio" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Accesso e permessi" subtitle="Questi dati non sono modificabili da questa pagina." />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Email">
            <Input value={member.email} readOnly />
          </Field>
          <Field label="Organization role">
            <Input value={ROLE_LABELS[member.role]} readOnly />
          </Field>
        </div>
      </Card>

      {avatarSaving && <p className="text-sm text-fg-subtle">Caricamento avatar in corso...</p>}
    </div>
  );
}
