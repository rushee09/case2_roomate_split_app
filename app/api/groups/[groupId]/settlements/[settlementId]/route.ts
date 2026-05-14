import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatCurrencyShort } from "@/lib/money";

// PATCH /api/groups/[groupId]/settlements/[settlementId]
// body: { action: "confirm" | "reject", actorMemberId: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { groupId: string; settlementId: string } }
) {
  try {
    const body = await request.json();
    const { action, actorMemberId } = body as {
      action: "confirm" | "reject";
      actorMemberId: string;
    };

    if (!action || !["confirm", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
    }

    const settlement = await db.settlement.findFirst({
      where: { id: params.settlementId, groupId: params.groupId },
      include: { fromMember: true, toMember: true, group: true },
    });

    if (!settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 });
    }

    if (settlement.status !== "PENDING_CONFIRMATION") {
      return NextResponse.json(
        { error: "Settlement is already confirmed or rejected" },
        { status: 409 }
      );
    }

    // Only the receiver (toMember) can confirm or reject
    if (actorMemberId !== settlement.toMemberId) {
      return NextResponse.json(
        { error: "Only the receiver can confirm or reject this settlement" },
        { status: 403 }
      );
    }

    const newStatus = action === "confirm" ? "CONFIRMED" : "REJECTED";
    const now = new Date();

    const updated = await db.settlement.update({
      where: { id: params.settlementId },
      data: {
        status: newStatus,
        confirmedAt: action === "confirm" ? now : null,
        rejectedAt: action === "reject" ? now : null,
      },
      include: { fromMember: true, toMember: true },
    });

    const currency = settlement.group.currency;
    const amountFormatted = formatCurrencyShort(settlement.amountPaise, currency);
    const methodLabel = formatMethodLabel(settlement.paymentMethod);

    const activityType = action === "confirm" ? "SETTLEMENT_CONFIRMED" : "SETTLEMENT_REJECTED";
    const activityMessage =
      action === "confirm"
        ? `${settlement.toMember.name} confirmed ${settlement.fromMember.name}'s ${amountFormatted} ${methodLabel} settlement.`
        : `${settlement.toMember.name} rejected ${settlement.fromMember.name}'s ${amountFormatted} ${methodLabel} settlement.`;

    // Audit log
    await db.activity.create({
      data: {
        groupId: params.groupId,
        type: activityType,
        data: JSON.stringify({
          settlementId: settlement.id,
          fromMemberName: settlement.fromMember.name,
          toMemberName: settlement.toMember.name,
          amountPaise: settlement.amountPaise,
          paymentMethod: settlement.paymentMethod,
          message: activityMessage,
        }),
      },
    });

    // Notify the payer about the outcome
    const notifTitle =
      action === "confirm" ? "Settlement confirmed!" : "Settlement rejected";
    const notifMessage =
      action === "confirm"
        ? `${settlement.toMember.name} confirmed your ${amountFormatted} payment via ${methodLabel}.`
        : `${settlement.toMember.name} rejected your ${amountFormatted} payment claim via ${methodLabel}.`;

    await db.notification.create({
      data: {
        groupId: params.groupId,
        recipientMemberId: settlement.fromMemberId,
        actorMemberId: settlement.toMemberId,
        type: activityType,
        title: notifTitle,
        message: notifMessage,
        relatedSettlementId: settlement.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/groups/[groupId]/settlements/[settlementId]]", error);
    return NextResponse.json({ error: "Failed to update settlement" }, { status: 500 });
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
