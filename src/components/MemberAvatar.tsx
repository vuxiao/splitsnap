import type { Member } from '../types/bill';

interface MemberAvatarProps {
  member: Member;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[11px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-base',
  lg: 'w-11 h-11 text-lg',
};

export function MemberAvatar({
  member,
  size = 'sm',
  className = '',
}: MemberAvatarProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 select-none border border-black/10 ${SIZE_MAP[size]} ${className}`}
      style={{ backgroundColor: `${member.color}18`, borderColor: `${member.color}40` }}
      aria-hidden="true"
    >
      <span className="leading-none">{member.avatar}</span>
    </span>
  );
}
