/**
 * Money utility — all monetary values are stored as integer paise
 * (1 INR = 100 paise) to avoid floating-point rounding errors.
 *
 * Display formatting converts back to human-readable currency strings.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Conversion helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert INR (float) to integer paise. ₹1200 → 120000 */
export function toPaise(inr: number): number {
  return Math.round(inr * 100);
}

/** Convert paise back to INR float. 120000 → 1200.00 */
export function toINR(paise: number): number {
  return paise / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format paise as a currency string, e.g. 120000 → "₹1,200.00" */
export function formatCurrency(
  paise: number,
  currency: string = "INR",
  locale: string = "en-IN"
): string {
  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = currencySymbols[currency] ?? currency;
  const amount = toINR(paise);

  // Use Intl for proper locale-aware formatting
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/** Short format — no trailing zeros for whole rupees, e.g. ₹1,200 */
export function formatCurrencyShort(
  paise: number,
  currency: string = "INR"
): string {
  const amount = toINR(paise);
  const isWhole = amount === Math.floor(amount);
  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = currencySymbols[currency] ?? currency;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${symbol}${isWhole ? amount.toFixed(0) : amount.toFixed(2)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Split calculation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate equal splits in paise.
 * Distributes any remainder paise to the first N members
 * (deterministic: members must be sorted by ID before calling).
 *
 * @example
 * // 3 members, ₹100 total → [3334, 3333, 3333] paise
 * calcEqualSplits(10000, 3) → [3334, 3333, 3333]
 */
export function calcEqualSplits(
  totalPaise: number,
  memberIds: string[]
): { memberId: string; amountPaise: number }[] {
  const n = memberIds.length;
  if (n === 0) return [];
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise - base * n;

  // Sort IDs for deterministic remainder distribution
  const sorted = [...memberIds].sort();
  return sorted.map((memberId, i) => ({
    memberId,
    amountPaise: base + (i < remainder ? 1 : 0),
  }));
}

/**
 * Calculate percentage splits in paise.
 * Assigns any paise rounding difference to the last participant.
 *
 * @param totalPaise — total expense amount in paise
 * @param splits — array of { memberId, percentage } (must sum to 100)
 */
export function calcPercentageSplits(
  totalPaise: number,
  splits: { memberId: string; percentage: number }[]
): { memberId: string; amountPaise: number; percentage: number }[] {
  let allocated = 0;
  return splits.map(({ memberId, percentage }, i) => {
    const isLast = i === splits.length - 1;
    const share = isLast
      ? totalPaise - allocated
      : Math.floor((percentage / 100) * totalPaise);
    allocated += share;
    return { memberId, amountPaise: share, percentage };
  });
}

/**
 * Validate that exact splits sum to the total.
 */
export function validateExactSplits(
  totalPaise: number,
  splits: { memberId: string; amountPaise: number }[]
): boolean {
  const sum = splits.reduce((acc, s) => acc + s.amountPaise, 0);
  return sum === totalPaise;
}
