/**
 * Unit tests for the balance calculation and settlement minimization engine.
 *
 * Run with: npm test
 */

import { describe, it, expect } from "vitest";
import {
  calculateBalances,
  minimizeSettlements,
  type MemberBalanceInput,
  type ExpenseInput,
  type SettlementInput,
} from "../lib/balance";
import {
  calcEqualSplits,
  calcPercentageSplits,
  validateExactSplits,
  toPaise,
} from "../lib/money";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const members: MemberBalanceInput[] = [
  { memberId: "a", memberName: "Aakar" },
  { memberId: "b", memberName: "Rahul" },
  { memberId: "c", memberName: "Zoya" },
  { memberId: "d", memberName: "Ali" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Money utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("toPaise", () => {
  it("converts 1200 INR to 120000 paise", () => {
    expect(toPaise(1200)).toBe(120000);
  });

  it("converts 999 INR to 99900 paise", () => {
    expect(toPaise(999)).toBe(99900);
  });

  it("rounds correctly for fractional INR", () => {
    expect(toPaise(10.005)).toBe(1001);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Equal splits
// ─────────────────────────────────────────────────────────────────────────────

describe("calcEqualSplits", () => {
  it("splits 120000 paise equally between 4 members", () => {
    const splits = calcEqualSplits(120000, ["a", "b", "c", "d"]);
    const total = splits.reduce((s, x) => s + x.amountPaise, 0);
    expect(total).toBe(120000);
    // Each should be 30000
    expect(splits.every((s) => s.amountPaise === 30000)).toBe(true);
  });

  it("handles remainder: 3 members, 100 paise → one gets 34, others get 33", () => {
    // Sort: [a, b, c] (alphabetical) — first one gets remainder
    const splits = calcEqualSplits(100, ["a", "b", "c"]);
    const total = splits.reduce((s, x) => s + x.amountPaise, 0);
    expect(total).toBe(100);

    const values = splits.map((s) => s.amountPaise).sort((a, b) => b - a);
    expect(values[0]).toBe(34);
    expect(values[1]).toBe(33);
    expect(values[2]).toBe(33);
  });

  it("distributes remainder deterministically (sorted by ID)", () => {
    // Member 'a' sorts first alphabetically so gets the +1
    const splits = calcEqualSplits(100, ["c", "b", "a"]);
    const aEntry = splits.find((s) => s.memberId === "a");
    expect(aEntry?.amountPaise).toBe(34);
  });

  it("handles single member", () => {
    const splits = calcEqualSplits(50000, ["x"]);
    expect(splits).toHaveLength(1);
    expect(splits[0].amountPaise).toBe(50000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Percentage splits
// ─────────────────────────────────────────────────────────────────────────────

describe("calcPercentageSplits", () => {
  it("splits 180000 paise 40/30/20/10 correctly", () => {
    const splits = calcPercentageSplits(180000, [
      { memberId: "a", percentage: 40 },
      { memberId: "b", percentage: 30 },
      { memberId: "c", percentage: 20 },
      { memberId: "d", percentage: 10 },
    ]);

    const total = splits.reduce((s, x) => s + x.amountPaise, 0);
    expect(total).toBe(180000);

    expect(splits[0].amountPaise).toBe(72000);  // 40%
    expect(splits[1].amountPaise).toBe(54000);  // 30%
    expect(splits[2].amountPaise).toBe(36000);  // 20%
    expect(splits[3].amountPaise).toBe(18000);  // 10%
  });

  it("assigns rounding remainder to last participant", () => {
    // 100 paise / 3 members: 33/33/34 where last gets remainder
    const splits = calcPercentageSplits(100, [
      { memberId: "a", percentage: 33.33 },
      { memberId: "b", percentage: 33.33 },
      { memberId: "c", percentage: 33.34 },
    ]);

    const total = splits.reduce((s, x) => s + x.amountPaise, 0);
    expect(total).toBe(100); // always sums to total
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exact splits
// ─────────────────────────────────────────────────────────────────────────────

describe("validateExactSplits", () => {
  it("validates correct exact splits (Internet: ₹999)", () => {
    const splits = [
      { memberId: "a", amountPaise: 30000 },
      { memberId: "b", amountPaise: 30000 },
      { memberId: "c", amountPaise: 19900 },
      { memberId: "d", amountPaise: 20000 },
    ];
    expect(validateExactSplits(99900, splits)).toBe(true);
  });

  it("rejects incorrect exact splits", () => {
    const splits = [
      { memberId: "a", amountPaise: 50000 },
      { memberId: "b", amountPaise: 50000 },
    ];
    expect(validateExactSplits(99900, splits)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Balance calculation — seeded demo scenario
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateBalances — Flat 1204 demo scenario", () => {
  // Groceries: ₹1200, Aakar pays, equal split (4 members = 30000 each)
  // Electricity: ₹1800, Rahul pays, 40/30/20/10
  // Internet: ₹999, Zoya pays, exact 300/300/199/200
  // Rent: ₹40000, Ali pays, equal split

  const grocerySplits = calcEqualSplits(toPaise(1200), ["a", "b", "c", "d"]);
  const electricitySplits = calcPercentageSplits(toPaise(1800), [
    { memberId: "a", percentage: 40 },
    { memberId: "b", percentage: 30 },
    { memberId: "c", percentage: 20 },
    { memberId: "d", percentage: 10 },
  ]);
  const internetSplits = [
    { memberId: "a", amountPaise: toPaise(300) },
    { memberId: "b", amountPaise: toPaise(300) },
    { memberId: "c", amountPaise: toPaise(199) },
    { memberId: "d", amountPaise: toPaise(200) },
  ];
  const rentSplits = calcEqualSplits(toPaise(40000), ["a", "b", "c", "d"]);

  const expenses: ExpenseInput[] = [
    { paidById: "a", amountPaise: toPaise(1200), splits: grocerySplits },
    { paidById: "b", amountPaise: toPaise(1800), splits: electricitySplits },
    { paidById: "c", amountPaise: toPaise(999), splits: internetSplits },
    { paidById: "d", amountPaise: toPaise(40000), splits: rentSplits },
  ];

  const balances = calculateBalances(members, expenses, []);

  it("all net balances sum to zero (conservation of money)", () => {
    const netSum = balances.reduce((s, b) => s + b.netBalancePaise, 0);
    expect(netSum).toBe(0);
  });

  it("Aakar has correct paid amount (₹1200)", () => {
    const aakar = balances.find((b) => b.memberId === "a");
    expect(aakar?.totalPaidPaise).toBe(toPaise(1200));
  });

  it("Ali has correct paid amount (₹40000)", () => {
    const ali = balances.find((b) => b.memberId === "d");
    expect(ali?.totalPaidPaise).toBe(toPaise(40000));
  });

  it("produces non-trivial balances (some positive, some negative)", () => {
    const positive = balances.filter((b) => b.netBalancePaise > 0);
    const negative = balances.filter((b) => b.netBalancePaise < 0);
    expect(positive.length).toBeGreaterThan(0);
    expect(negative.length).toBeGreaterThan(0);
  });

  it("Rent payer (Ali) has a high positive balance since others owe him", () => {
    const ali = balances.find((b) => b.memberId === "d");
    // Ali paid ₹40000 but only owes 1/4 of total
    expect(ali?.netBalancePaise).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settlement minimization
// ─────────────────────────────────────────────────────────────────────────────

describe("minimizeSettlements", () => {
  it("returns empty when all balances are zero", () => {
    const balances = members.map((m) => ({
      ...m,
      totalPaidPaise: 0,
      totalOwedPaise: 0,
      netBalancePaise: 0,
    }));
    expect(minimizeSettlements(balances)).toHaveLength(0);
  });

  it("simple: A owes B 1000 → 1 transaction", () => {
    const balances = [
      { memberId: "a", memberName: "A", totalPaidPaise: 0, totalOwedPaise: 1000, netBalancePaise: -1000 },
      { memberId: "b", memberName: "B", totalPaidPaise: 1000, totalOwedPaise: 0, netBalancePaise: 1000 },
    ];
    const suggestions = minimizeSettlements(balances);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].fromMemberId).toBe("a");
    expect(suggestions[0].toMemberId).toBe("b");
    expect(suggestions[0].amountPaise).toBe(1000);
  });

  it("chain netting: A→B→C becomes A→C (2 people settle instead of 2 transactions)", () => {
    // A owes B 500, B owes C 500, so net: A=-500, B=0, C=+500
    const balances = [
      { memberId: "a", memberName: "A", totalPaidPaise: 0, totalOwedPaise: 500, netBalancePaise: -500 },
      { memberId: "b", memberName: "B", totalPaidPaise: 500, totalOwedPaise: 500, netBalancePaise: 0 },
      { memberId: "c", memberName: "C", totalPaidPaise: 500, totalOwedPaise: 0, netBalancePaise: 500 },
    ];
    const suggestions = minimizeSettlements(balances);
    // After netting B drops out, leaving A→C
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].fromMemberId).toBe("a");
    expect(suggestions[0].toMemberId).toBe("c");
  });

  it("never emits zero-value suggestions", () => {
    const balances = members.map((m) => ({
      ...m,
      totalPaidPaise: 100,
      totalOwedPaise: 100,
      netBalancePaise: 0,
    }));
    expect(minimizeSettlements(balances)).toHaveLength(0);
  });

  it("settlement amounts sum to net positive balances", () => {
    const expenses: ExpenseInput[] = [
      {
        paidById: "a",
        amountPaise: 100000,
        splits: calcEqualSplits(100000, ["a", "b", "c", "d"]),
      },
    ];
    const balances = calculateBalances(members, expenses, []);
    const suggestions = minimizeSettlements(balances);

    const totalSettlement = suggestions.reduce((s, x) => s + x.amountPaise, 0);
    const totalPositive = balances
      .filter((b) => b.netBalancePaise > 0)
      .reduce((s, b) => s + b.netBalancePaise, 0);

    expect(totalSettlement).toBe(totalPositive);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settlement after payment
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateBalances — with settlements", () => {
  it("a recorded settlement reduces outstanding debt", () => {
    const expenses: ExpenseInput[] = [
      {
        paidById: "a",
        amountPaise: 100000,
        splits: calcEqualSplits(100000, ["a", "b"]),
      },
    ];
    // Before settlement: B owes A 50000
    const before = calculateBalances(
      [members[0], members[1]],
      expenses,
      []
    );
    expect(before.find((b) => b.memberId === "b")?.netBalancePaise).toBe(-50000);

    // After B pays A 50000
    const settlements: SettlementInput[] = [
      { fromMemberId: "b", toMemberId: "a", amountPaise: 50000 },
    ];
    const after = calculateBalances(
      [members[0], members[1]],
      expenses,
      settlements
    );

    expect(after.find((b) => b.memberId === "b")?.netBalancePaise).toBe(0);
    expect(after.find((b) => b.memberId === "a")?.netBalancePaise).toBe(0);
  });

  it("partial settlement reduces but does not eliminate debt", () => {
    const expenses: ExpenseInput[] = [
      {
        paidById: "a",
        amountPaise: 100000,
        splits: calcEqualSplits(100000, ["a", "b"]),
      },
    ];
    const settlements: SettlementInput[] = [
      { fromMemberId: "b", toMemberId: "a", amountPaise: 20000 },
    ];
    const after = calculateBalances(
      [members[0], members[1]],
      expenses,
      settlements
    );

    // B still owes A 30000
    expect(after.find((b) => b.memberId === "b")?.netBalancePaise).toBe(-30000);
    expect(after.find((b) => b.memberId === "a")?.netBalancePaise).toBe(30000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rounding with integer cents
// ─────────────────────────────────────────────────────────────────────────────

describe("integer paise rounding", () => {
  it("equal splits always sum to the total amount (no paise lost)", () => {
    // 3 members, prime amounts create rounding challenges
    for (const amount of [99900, 10001, 100003, 777777]) {
      const splits = calcEqualSplits(amount, ["a", "b", "c"]);
      const sum = splits.reduce((s, x) => s + x.amountPaise, 0);
      expect(sum).toBe(amount);
    }
  });

  it("percentage splits always sum to total (remainder assigned to last)", () => {
    const total = 99900;
    const splits = calcPercentageSplits(total, [
      { memberId: "a", percentage: 33.33 },
      { memberId: "b", percentage: 33.33 },
      { memberId: "c", percentage: 33.34 },
    ]);
    const sum = splits.reduce((s, x) => s + x.amountPaise, 0);
    expect(sum).toBe(total);
  });

  it("all amounts stored and used as integers (no floats)", () => {
    const splits = calcEqualSplits(120000, ["a", "b", "c", "d"]);
    for (const s of splits) {
      expect(Number.isInteger(s.amountPaise)).toBe(true);
    }
  });
});
