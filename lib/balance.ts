/**
 * Balance calculation engine for Pocket Expense Splitter.
 *
 * ALGORITHM EXPLANATION (also in README and code comments):
 * ──────────────────────────────────────────────────────────
 * The app converts every expense into ledger entries. For each expense, the
 * payer receives credit for the full amount paid, and each participant receives
 * a debit for their share. The net position is total paid minus total owed.
 *
 * Members with positive net balances are creditors (should receive money).
 * Members with negative net balances are debtors (owe money).
 *
 * The settlement engine greedily pairs the largest debtor with the largest
 * creditor until all balances are resolved, producing the minimum practical
 * set of settlement suggestions for the group.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberBalanceInput {
  memberId: string;
  memberName: string;
}

export interface ExpenseInput {
  paidById: string;
  amountPaise: number;
  splits: { memberId: string; amountPaise: number }[];
}

export interface SettlementInput {
  fromMemberId: string;
  toMemberId: string;
  amountPaise: number;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  /** Sum of all expenses paid by this member, in paise */
  totalPaidPaise: number;
  /** Sum of all expense shares assigned to this member, in paise */
  totalOwedPaise: number;
  /**
   * Net balance in paise.
   * Positive = creditor (is owed money by others).
   * Negative = debtor (owes money to others).
   */
  netBalancePaise: number;
}

export interface SettlementSuggestion {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amountPaise: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core balance calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate net balances for all members in a group.
 *
 * Steps:
 * 1. For each expense, credit the payer for the full amount.
 * 2. For each expense split, debit the participant for their share.
 * 3. For each settlement, credit the payer and debit the receiver
 *    (settlements reduce outstanding debts).
 * 4. Net balance = totalPaid - totalOwed.
 */
export function calculateBalances(
  members: MemberBalanceInput[],
  expenses: ExpenseInput[],
  settlements: SettlementInput[]
): MemberBalance[] {
  // Initialize ledger with zeros
  const ledger = new Map<string, { paid: number; owed: number }>();
  for (const m of members) {
    ledger.set(m.memberId, { paid: 0, owed: 0 });
  }

  // Process expenses
  for (const expense of expenses) {
    const payer = ledger.get(expense.paidById);
    if (payer) {
      payer.paid += expense.amountPaise;
    }

    for (const split of expense.splits) {
      const participant = ledger.get(split.memberId);
      if (participant) {
        participant.owed += split.amountPaise;
      }
    }
  }

  // Process settlements
  // A settlement of X paise from A to B means:
  // - A paid X more (increases A's net / reduces what A owes)
  // - B received X (increases B's owed, since they got paid back)
  for (const settlement of settlements) {
    const payer = ledger.get(settlement.fromMemberId);
    if (payer) {
      payer.paid += settlement.amountPaise;
    }
    const receiver = ledger.get(settlement.toMemberId);
    if (receiver) {
      receiver.owed += settlement.amountPaise;
    }
  }

  return members.map((m) => {
    const entry = ledger.get(m.memberId) ?? { paid: 0, owed: 0 };
    return {
      memberId: m.memberId,
      memberName: m.memberName,
      totalPaidPaise: entry.paid,
      totalOwedPaise: entry.owed,
      netBalancePaise: entry.paid - entry.owed,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Settlement minimization (greedy)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the minimum set of settlement transactions using a greedy algorithm.
 *
 * Algorithm:
 * 1. Separate members into creditors (positive net) and debtors (negative net).
 * 2. Sort each group descending by absolute balance.
 * 3. Repeatedly match the largest debtor with the largest creditor.
 * 4. The settlement amount is min(debtor balance, creditor balance).
 * 5. Reduce both balances by the settlement amount.
 * 6. Remove fully settled members and repeat until empty.
 *
 * This is deterministic and produces the theoretically optimal number of
 * transactions for this problem class.
 *
 * Zero-value suggestions are never emitted.
 */
export function minimizeSettlements(
  balances: MemberBalance[]
): SettlementSuggestion[] {
  // Work on mutable copies
  const creditors = balances
    .filter((b) => b.netBalancePaise > 0)
    .map((b) => ({ ...b, remaining: b.netBalancePaise }));

  const debtors = balances
    .filter((b) => b.netBalancePaise < 0)
    .map((b) => ({ ...b, remaining: Math.abs(b.netBalancePaise) }));

  const suggestions: SettlementSuggestion[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending by remaining balance (greedy: largest first)
    debtors.sort((a, b) => b.remaining - a.remaining);
    creditors.sort((a, b) => b.remaining - a.remaining);

    const debtor = debtors[0];
    const creditor = creditors[0];

    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount <= 0) break; // Safety: avoid infinite loop on rounding edge cases

    suggestions.push({
      fromMemberId: debtor.memberId,
      fromMemberName: debtor.memberName,
      toMemberId: creditor.memberId,
      toMemberName: creditor.memberName,
      amountPaise: amount,
    });

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    // Remove fully settled members
    if (debtor.remaining === 0) debtors.shift();
    if (creditor.remaining === 0) creditors.shift();
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group summary helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupSummary {
  totalGroupSpendPaise: number;
  unsettledCount: number;
}

export function calcGroupSummary(
  expenses: ExpenseInput[],
  balances: MemberBalance[]
): GroupSummary {
  const totalGroupSpendPaise = expenses.reduce(
    (sum, e) => sum + e.amountPaise,
    0
  );
  const suggestions = minimizeSettlements(balances);
  return {
    totalGroupSpendPaise,
    unsettledCount: suggestions.length,
  };
}
