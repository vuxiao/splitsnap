import {
  MEMBER_AVATARS,
  type Member,
  type SwissStampVariant,
} from '../types/bill';

interface MemberAvatarProps {
  member: Member;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
};

/**
 * 从成员姓名提取瑞士印刷体单字 / 首字母 Monogram
 */
export function getMemberMonogram(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return 'M';
  const chars = Array.from(cleaned);
  const first = chars[0];
  // 若为英文或数字，取大写首字符（如两字母英文短名保留首字母）
  if (/^[a-zA-Z0-9]$/.test(first)) {
    return first.toUpperCase();
  }
  return first;
}

/**
 * 将任意 avatar 字符串稳定映射到 8 款瑞士印章变体（兼容旧分享链接里的 emoji，确保不渲染彩色系统表情）
 */
function resolveStampVariant(member: Member): SwissStampVariant {
  if ((MEMBER_AVATARS as readonly string[]).includes(member.avatar)) {
    return member.avatar as SwissStampVariant;
  }
  // 旧数据或未知值：基于 member.id + name 做确定性哈希映射
  const seed = `${member.id}:${member.name}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MEMBER_AVATARS[hash % MEMBER_AVATARS.length];
}

const VARIANT_CLASSES: Record<SwissStampVariant, string> = {
  'ink-solid':
    'rounded-full bg-[#141413] text-[#FFFDF9] border border-[#141413]',
  'orange-ring':
    'rounded-full bg-[#FFF0EB] text-[#FF4D1A] border-[1.5px] border-[#FF4D1A]',
  'green-solid':
    'rounded-full bg-[#0D9468] text-[#FFFDF9] border border-[#0D9468]',
  'ink-square':
    'rounded-[5px] bg-[#FFFDF9] text-[#141413] border-[1.5px] border-[#141413]',
  'orange-solid':
    'rounded-full bg-[#FF4D1A] text-[#FFFDF9] border border-[#FF4D1A]',
  'green-ring':
    'rounded-[5px] bg-[#E9F7F1] text-[#0D9468] border-[1.5px] border-[#0D9468]',
  'slate-solid':
    'rounded-full bg-[#4A463F] text-[#FFFDF9] border border-[#4A463F]',
  'paper-double':
    'rounded-full bg-[#F5F2EB] text-[#141413] border border-dashed border-[#141413] ring-1 ring-inset ring-[#141413]/25',
};

export function MemberAvatar({
  member,
  size = 'sm',
  className = '',
}: MemberAvatarProps) {
  const variant = resolveStampVariant(member);
  const monogram = getMemberMonogram(member.name);

  return (
    <span
      data-stamp-variant={variant}
      className={`inline-flex items-center justify-center shrink-0 select-none font-bold leading-none tracking-tight ${SIZE_MAP[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      aria-hidden="true"
    >
      <span className="translate-y-[0.5px]">{monogram}</span>
    </span>
  );
}
