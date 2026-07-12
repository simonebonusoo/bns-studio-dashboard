import type { Member } from '@/types';

export function memberDisplayName(member: Pick<Member, 'firstName' | 'lastName' | 'displayName'>) {
  return member.displayName?.trim() || `${member.firstName} ${member.lastName}`.trim();
}

export function memberAvatarProps(member: Pick<Member, 'firstName' | 'lastName' | 'displayName' | 'avatarColor' | 'avatarUrl'>) {
  return {
    name: memberDisplayName(member),
    color: member.avatarColor,
    src: member.avatarUrl ?? undefined,
  };
}
