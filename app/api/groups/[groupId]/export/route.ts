import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/money";

// GET /api/groups/[groupId]/export — download group activity as CSV
export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const group = await db.group.findUnique({
      where: { id: params.groupId },
      include: {
        expenses: {
          include: { paidBy: true, splits: { include: { member: true } } },
          orderBy: { date: "asc" },
        },
        settlements: {
          include: { fromMember: true, toMember: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Build CSV rows
    const rows: string[] = [
      // Header
      "Type,Date,Title,Amount,Paid By,Split Type,Category,Notes",
    ];

    for (const expense of group.expenses) {
      rows.push(
        [
          "Expense",
          new Date(expense.date).toISOString().split("T")[0],
          `"${expense.title.replace(/"/g, '""')}"`,
          formatCurrency(expense.amountPaise, group.currency),
          expense.paidBy.name,
          expense.splitType,
          expense.category ?? "",
          `"${(expense.notes ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    }

    for (const settlement of group.settlements) {
      rows.push(
        [
          "Settlement",
          new Date(settlement.createdAt).toISOString().split("T")[0],
          `"${settlement.fromMember.name} paid ${settlement.toMember.name}"`,
          formatCurrency(settlement.amountPaise, group.currency),
          settlement.fromMember.name,
          "SETTLEMENT",
          "",
          `"${(settlement.note ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    }

    const csv = rows.join("\n");
    const filename = `${group.name.replace(/\s+/g, "_")}_activity.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/groups/[groupId]/export]", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
