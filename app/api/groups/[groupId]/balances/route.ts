import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateBalances, minimizeSettlements } from "@/lib/balance";

// GET /api/groups/[groupId]/balances
// Returns member balances and minimized settlement suggestions
export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const group = await db.group.findUnique({
      where: { id: params.groupId },
      include: {
        members: { orderBy: { createdAt: "asc" } },
        expenses: {
          include: {
            splits: true,
          },
        },
        settlements: true,
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberInputs = group.members.map((m) => ({
      memberId: m.id,
      memberName: m.name,
    }));

    const expenseInputs = group.expenses.map((e) => ({
      paidById: e.paidById,
      amountPaise: e.amountPaise,
      splits: e.splits.map((s) => ({
        memberId: s.memberId,
        amountPaise: s.amountPaise,
      })),
    }));

    const settlementInputs = group.settlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amountPaise: s.amountPaise,
    }));

    const balances = calculateBalances(memberInputs, expenseInputs, settlementInputs);
    const suggestions = minimizeSettlements(balances);

    const totalGroupSpendPaise = group.expenses.reduce(
      (sum, e) => sum + e.amountPaise,
      0
    );

    return NextResponse.json({
      balances,
      suggestions,
      totalGroupSpendPaise,
      currency: group.currency,
    });
  } catch (error) {
    console.error("[GET /api/groups/[groupId]/balances]", error);
    return NextResponse.json({ error: "Failed to calculate balances" }, { status: 500 });
  }
}
