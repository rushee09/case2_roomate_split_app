import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatCurrencyShort } from "@/lib/money";

/**
 * GET /api/cron/settlement-reminders
 *
 * Sends reminder notifications for settlements that have been PENDING_CONFIRMATION
 * for more than 15 days without action.
 *
 * Schedule this route with a cron service (e.g. Vercel Cron, GitHub Actions, etc.)
 * to run daily. Protect it with CRON_SECRET env var.
 *
 * Example Vercel cron config (vercel.json):
 *   { "crons": [{ "path": "/api/cron/settlement-reminders", "schedule": "0 9 * * *" }] }
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const staleSettlements = await db.settlement.findMany({
      where: {
        status: "PENDING_CONFIRMATION",
        createdAt: { lte: fifteenDaysAgo },
      },
      include: {
        fromMember: true,
        toMember: true,
        group: true,
      },
    });

    let created = 0;

    for (const s of staleSettlements) {
      // Avoid duplicate reminders — check if a reminder was already sent in the last 15 days
      const existing = await db.notification.findFirst({
        where: {
          relatedSettlementId: s.id,
          type: "SETTLEMENT_REMINDER",
          createdAt: { gte: fifteenDaysAgo },
        },
      });

      if (existing) continue;

      const amountFormatted = formatCurrencyShort(s.amountPaise, s.group.currency);
      const methodLabel = formatMethodLabel(s.paymentMethod);

      await db.notification.create({
        data: {
          groupId: s.groupId,
          recipientMemberId: s.toMemberId,
          actorMemberId: s.fromMemberId,
          type: "SETTLEMENT_REMINDER",
          title: "Pending settlement reminder",
          message: `Reminder: ${s.fromMember.name} is waiting for your confirmation on a ${amountFormatted} ${methodLabel} payment from ${Math.floor((Date.now() - s.createdAt.getTime()) / 86400000)} days ago.`,
          relatedSettlementId: s.id,
        },
      });

      created++;
    }

    return NextResponse.json({ ok: true, remindersCreated: created });
  } catch (error) {
    console.error("[GET /api/cron/settlement-reminders]", error);
    return NextResponse.json({ error: "Failed to process reminders" }, { status: 500 });
  }
}

function formatMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CARD: "Card",
    OTHER: "Other",
  };
  return map[method] ?? method;
}
