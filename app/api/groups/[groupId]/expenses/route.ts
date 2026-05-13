import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { toPaise, calcEqualSplits, calcPercentageSplits } from "@/lib/money";

export async function GET(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expenses = await db.expense.findMany({
    where: { groupId: params.groupId },
    include: { paidBy: true, splits: { include: { member: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(expenses);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, amountInr, paidById, date, category, notes, splitType, split, isRecurring, recurringPeriod } = body;

  if (!title?.trim() || !amountInr || !paidById || !split)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const payer = await db.member.findFirst({ where: { id: paidById, groupId: params.groupId } });
  if (!payer) return NextResponse.json({ error: "Payer is not a group member" }, { status: 400 });

  const totalPaise = toPaise(amountInr);
  let splitsData: { memberId: string; amountPaise: number; percentage?: number }[] = [];

  if (split.type === "EQUAL") {
    splitsData = calcEqualSplits(totalPaise, split.memberIds);
  } else if (split.type === "PERCENTAGE") {
    splitsData = calcPercentageSplits(totalPaise, split.splits);
  } else if (split.type === "EXACT") {
    splitsData = split.splits.map((s: { memberId: string; amountInr: number }) => ({
      memberId: s.memberId,
      amountPaise: toPaise(s.amountInr),
    }));
  }

  const expense = await db.expense.create({
    data: {
      title: title.trim(),
      amountPaise: totalPaise,
      paidById,
      groupId: params.groupId,
      date: date ? new Date(date) : new Date(),
      category: category || null,
      notes: notes || null,
      splitType: split.type,
      isRecurring: isRecurring ?? false,
      recurringPeriod: recurringPeriod || null,
      splits: { create: splitsData },
    },
    include: { paidBy: true, splits: { include: { member: true } } },
  });

  await db.activity.create({
    data: {
      groupId: params.groupId,
      type: "EXPENSE_ADDED",
      data: JSON.stringify({ expenseId: expense.id, title: expense.title, amountPaise: totalPaise, paidByName: payer.name }),
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
