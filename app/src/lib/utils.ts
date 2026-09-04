import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Chain, type ChainMeta } from '@/lib/chain';
import { formatAccountCurrency, formatAccountDate, readAccountCountry } from '@/lib/accountLocale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TITLE_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
  "via",
  "with",
]);

function titleCaseToken(token: string, forceCap: boolean): string {
  if (token.includes("-") && /[A-Za-z]/.test(token)) {
    return token
      .split("-")
      .map((part, index, parts) => titleCaseToken(part, forceCap || index === 0 || index === parts.length - 1))
      .join("-");
  }

  const match = token.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z']*)(.*)$/);
  if (!match) return token;

  const [, lead, word, rest] = match;
  if (/[A-Z].*[A-Z]/.test(word) && word !== word.toUpperCase()) return token;
  if (word.length > 1 && word === word.toUpperCase()) return token;

  const lower = word.toLowerCase();
  if (!forceCap && TITLE_SMALL_WORDS.has(lower)) return `${lead}${lower}${rest}`;
  return `${lead}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${rest}`;
}

/** Chicago-style title case for headings and document titles. */
export function toTitleCase(input: string): string {
  return input.replace(/[^.!?]+(?:[.!?]+)?/g, (clause) => {
    const tokens = clause.split(/(\s+)/);
    const wordIndexes = tokens.flatMap((token, index) => (/[A-Za-z]/.test(token) ? [index] : []));
    if (wordIndexes.length === 0) return clause;

    const first = wordIndexes[0];
    const last = wordIndexes[wordIndexes.length - 1];
    return tokens
      .map((token, index) =>
        /[A-Za-z]/.test(token) ? titleCaseToken(token, index === first || index === last) : token,
      )
      .join("");
  });
}

export function formatKSh(amount: number): string {
  return formatAccountCurrency(amount);
}

export function formatUSD(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

export function formatRailAmountFromKes(amountKes: number, chainOrMeta: Chain | ChainMeta): string {
  void chainOrMeta;
  return formatKSh(amountKes);
}

export function formatRailAmountWithKes(amountKes: number, chainOrMeta: Chain | ChainMeta): string {
  void chainOrMeta;
  return formatKSh(amountKes);
}

export function formatRailDate(
  value: string | number | Date,
  chainOrMeta: Chain | ChainMeta,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  void chainOrMeta;
  return formatAccountDate(value, readAccountCountry(), options);
}

export function formatRailDateTime(
  value: string | number | Date,
  chainOrMeta: Chain | ChainMeta,
): string {
  void chainOrMeta;
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function daysRemaining(endsAt: string): number {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}
