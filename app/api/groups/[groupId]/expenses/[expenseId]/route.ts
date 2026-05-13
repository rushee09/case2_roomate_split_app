import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/groups/[groupId]/expenses/[expenseId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { groupId: string; expenseId: string } }
) {
  try {
    const expense = await db.expense.findFirst({
      where: { id: params.expenseId, groupId: params.groupId },
      include: { paidBy: true },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await db.expense.delete({ where: { id: params.expenseId } });

    // Audit log
    await db.activity.create({
      data: {
        groupId: params.groupId,
        type: "EXPENSE_DELETED",
        data: JSON.stringify({
          expenseId: params.expenseId,
          title: expense.title,
          amountPaise: expense.amountPaise,
          paidByName: expense.paidBy.name,
        }),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/groups/[groupId]/expenses/[expenseId]]", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
