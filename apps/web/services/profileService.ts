import { env } from '@/config/env';
import { getActiveSession } from '@/services/session';
import { getSupabaseClient } from '@/services/supabase';
import { repositories } from '@/services/repository';
import type { Member } from '@/types';

const AVATAR_BUCKET = 'bns-avatars';
const MAX_AVATAR_MB = 5;
const AVATAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function assertAvatar(file: File) {
  if (!AVATAR_MIME[file.type]) {
    throw new Error('Formato avatar non supportato. Usa JPG, PNG o WebP.');
  }
  if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
    throw new Error(`Avatar troppo grande. Limite ${MAX_AVATAR_MB}MB.`);
  }
}

async function normalizedAvatarBytes(file: File) {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Lettura avatar non riuscita'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

export async function updateOwnProfile(patch: Partial<Member>) {
  const session = getActiveSession();
  if (!session.memberId || !session.userId) throw new Error('Sessione non disponibile');

  const updated = await repositories.members.update(session.memberId, patch);

  const profilePatch = {
    first_name: patch.firstName,
    last_name: patch.lastName,
    display_name: patch.displayName,
    phone: patch.phone,
    bio: patch.bio,
    avatar_url: patch.avatarUrl,
    updated_at: new Date().toISOString(),
  };
  const cleanPatch = Object.fromEntries(Object.entries(profilePatch).filter(([, value]) => value !== undefined));
  if (Object.keys(cleanPatch).length > 1) {
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update(cleanPatch as never)
      .eq('id', session.userId);
    if (error) throw error;
  }

  return updated;
}

export async function uploadOwnAvatar(file: File) {
  assertAvatar(file);
  const session = getActiveSession();
  if (!session.organizationId || !session.userId || !session.memberId) {
    throw new Error('Sessione non disponibile');
  }

  const supabase = getSupabaseClient();
  const prefix = `${session.organizationId}/${session.userId}`;
  const { data: existing } = await supabase.storage.from(AVATAR_BUCKET).list(prefix);
  const stale = (existing ?? []).map((item) => `${prefix}/${item.name}`);
  if (stale.length > 0) {
    await supabase.storage.from(AVATAR_BUCKET).remove(stale);
  }

  const ext = AVATAR_MIME[file.type];
  const path = `${prefix}/avatar-${Date.now()}.${ext}`;
  const body = await normalizedAvatarBytes(file);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = data.publicUrl || `${env.supabaseUrl}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
  return updateOwnProfile({ avatarUrl });
}
