import LZString from 'lz-string';
import { MEMBER_AVATARS, MEMBER_PALETTE, type Bill, type Expense, type Member } from '../types/bill';

/**
 * 极紧凑序列化载荷（比原始 JSON 缩短 ~50%，使二维码更稀疏易扫）
 */
interface CompactPayloadV1 {
  v: 1;
  t: string; // title
  r: string; // receiptNo
  c: string; // currency
  /** [id, name, colorIdxOrHex, avatar] */
  m: Array<[string, string, number | string, string]>;
  /**
   * [id, title, amountCents, payerIdx, mode(0=equal,1=custom), data, note?]
   * - equal: data 为 participant memberIdx 数组
   * - custom: data 为 [memberIdx, cents] 二维数组
   */
  e: Array<
    [
      string,
      string,
      number,
      number,
      0 | 1,
      number[] | Array<[number, number]>,
      string?,
    ]
  >;
  /** settledKeys */
  s: string[];
  /** createdAt */
  at: number;
}

const HASH_PREFIX = '#s=';

export function encodeBillToToken(bill: Bill): string {
  const memberIdxMap = new Map<string, number>();
  const compactMembers: CompactPayloadV1['m'] = bill.members.map((m, idx) => {
    memberIdxMap.set(m.id, idx);
    const paletteIdx = (MEMBER_PALETTE as readonly string[]).indexOf(m.color);
    return [m.id, m.name, paletteIdx >= 0 ? paletteIdx : m.color, m.avatar];
  });

  const compactExpenses: CompactPayloadV1['e'] = bill.expenses.map((exp) => {
    const payerIdx = memberIdxMap.get(exp.payerId) ?? 0;
    if (exp.splitMode === 'custom' && exp.customSharesCents) {
      const pairs: Array<[number, number]> = [];
      for (const [mId, cents] of Object.entries(exp.customSharesCents)) {
        const idx = memberIdxMap.get(mId);
        if (idx !== undefined && cents > 0) {
          pairs.push([idx, Math.round(cents)]);
        }
      }
      const tuple: CompactPayloadV1['e'][number] = [
        exp.id,
        exp.title,
        Math.round(exp.amountCents),
        payerIdx,
        1,
        pairs,
      ];
      if (exp.note) tuple.push(exp.note);
      return tuple;
    }

    const partIndices = exp.participantIds
      .map((id) => memberIdxMap.get(id))
      .filter((i): i is number => i !== undefined);

    const tuple: CompactPayloadV1['e'][number] = [
      exp.id,
      exp.title,
      Math.round(exp.amountCents),
      payerIdx,
      0,
      partIndices,
    ];
    if (exp.note) tuple.push(exp.note);
    return tuple;
  });

  const payload: CompactPayloadV1 = {
    v: 1,
    t: bill.title,
    r: bill.receiptNo,
    c: bill.currency || '¥',
    m: compactMembers,
    e: compactExpenses,
    s: bill.settledKeys,
    at: bill.createdAt,
  };

  const json = JSON.stringify(payload);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeBillFromToken(token: string): Bill | null {
  try {
    if (!token || token.length < 4) return null;
    const json = LZString.decompressFromEncodedURIComponent(token);
    if (!json) return null;

    const raw = JSON.parse(json) as CompactPayloadV1;
    if (!raw || raw.v !== 1 || !Array.isArray(raw.m) || !Array.isArray(raw.e)) {
      return null;
    }

    const members: Member[] = raw.m.map((item, idx) => {
      const [id, name, colorVal, avatar] = item;
      const color =
        typeof colorVal === 'number'
          ? MEMBER_PALETTE[colorVal % MEMBER_PALETTE.length]
          : colorVal || MEMBER_PALETTE[idx % MEMBER_PALETTE.length];
      return {
        id: String(id || `m${idx + 1}`),
        name: String(name || `成员${idx + 1}`),
        color,
        avatar: String(avatar || MEMBER_AVATARS[idx % MEMBER_AVATARS.length]),
      };
    });

    const expenses: Expense[] = raw.e.map((item, idx) => {
      const [id, title, amountCents, payerIdx, mode, data, note] = item;
      const payer = members[payerIdx] ?? members[0];
      if (mode === 1 && Array.isArray(data)) {
        const customSharesCents: Record<string, number> = {};
        const participantIds: string[] = [];
        for (const pair of data as Array<[number, number]>) {
          if (Array.isArray(pair) && pair.length === 2) {
            const m = members[pair[0]];
            if (m && pair[1] > 0) {
              customSharesCents[m.id] = Math.round(pair[1]);
              participantIds.push(m.id);
            }
          }
        }
        return {
          id: String(id || `e${idx + 1}`),
          title: String(title || '未命名消费'),
          amountCents: Math.max(0, Math.round(Number(amountCents) || 0)),
          payerId: payer?.id ?? '',
          splitMode: 'custom',
          participantIds,
          customSharesCents,
          createdAt: raw.at + idx * 1000,
          note: note ? String(note) : undefined,
        };
      }

      const participantIds = (Array.isArray(data) ? (data as number[]) : [])
        .map((mIdx) => members[mIdx]?.id)
        .filter((x): x is string => Boolean(x));

      return {
        id: String(id || `e${idx + 1}`),
        title: String(title || '未命名消费'),
        amountCents: Math.max(0, Math.round(Number(amountCents) || 0)),
        payerId: payer?.id ?? '',
        splitMode: 'equal',
        participantIds,
        createdAt: raw.at + idx * 1000,
        note: note ? String(note) : undefined,
      };
    });

    const now = Date.now();
    return {
      id: `shared_${now.toString(36)}`,
      title: String(raw.t || '分享的账单'),
      receiptNo: String(raw.r || 'SS-SHARED'),
      currency: String(raw.c || '¥'),
      members,
      expenses,
      settledKeys: Array.isArray(raw.s) ? raw.s.map(String) : [],
      createdAt: Number(raw.at) || now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(bill: Bill, baseHref?: string): string {
  const token = encodeBillToToken(bill);
  const url = new URL(baseHref ?? window.location.href);
  url.search = '';
  url.hash = `${HASH_PREFIX}${token}`;
  return url.toString();
}

export function extractTokenFromLocation(loc: {
  hash: string;
  search: string;
}): string | null {
  if (loc.hash.startsWith(HASH_PREFIX)) {
    return loc.hash.slice(HASH_PREFIX.length);
  }
  const params = new URLSearchParams(loc.search);
  return params.get('s');
}
