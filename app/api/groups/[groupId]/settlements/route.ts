import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreateSettlementSchema } from "@/lib/validations";
import { sendSettlementNotification } from "@/lib/email_service";
import { formatCurrencyShort } from "@/lib/money";

// GET /api/groups/[groupId]/settlements
export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const settlements = await db.settlement.findMany({
      where: { groupId: params.groupId },
      include: { fromMember: true, toMember: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(settlements);
  } catch (error) {
    console.error("[GET /api/groups/[groupId]/settlements]", error);
    return NextResponse.json({ error: "Failed to fetch settlements" }, { status: 500 });
  }
}

// POST /api/groups/[groupId]/settlements — record a settle-up (status: PENDING_CONFIRMATION)
export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const body = await request.json();
    const parsed = CreateSettlementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fromMemberId, toMemberId, amountPaise, paymentMethod, paymentReference, proofUrl, note } = parsed.data;

    // Verify both members belong to this group
    const [fromMember, toMember, group] = await Promise.all([
      db.member.findFirst({ where: { id: fromMemberId, groupId: params.groupId } }),
      db.member.findFirst({ where: { id: toMemberId, groupId: params.groupId }, include: { user: true } }),
      db.group.findUnique({ where: { id: params.groupId } }),
    ]);

    if (!fromMember || !toMember) {
      return NextResponse.json(
        { error: "One or both members are not part of this group" },
        { status: 400 }
      );
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (fromMemberId === toMemberId) {
      return NextResponse.json(
        { error: "Payer and receiver cannot be the same member" },
        { status: 400 }
      );
    }

    const currency = group.currency;
    const amountFormatted = formatCurrencyShort(amountPaise, currency);

    const settlement = await db.settlement.create({
      data: {
        groupId: params.groupId,
        fromMemberId,
        toMemberId,
        amountPaise,
        paymentMethod: paymentMethod ?? "CASH",
        paymentReference: paymentReference || null,
        proofUrl: proofUrl || null,
        note: note || null,
        status: "PENDING_CONFIRMATION",
      },
      include: { fromMember: true, toMember: true },
    });

    const methodLabel = formatMethodLabel(paymentMethod ?? "CASH");

    // Audit log
    await db.activity.create({
      data: {
        groupId: params.groupId,
        type: "SETTLEMENT_RECORDED",
        data: JSON.stringify({
          settlementId: settlement.id,
          fromMemberName: fromMember.name,
          toMemberName: toMember.name,
          amountPaise,
          paymentMethod: paymentMethod ?? "CASH",
          paymentReference: paymentReference || null,
        }),
      },
    });

    // In-app notification for receiver
    await db.notification.create({
      data: {
        groupId: params.groupId,
        recipientMemberId: toMemberId,
        actorMemberId: fromMemberId,
        type: "SETTLEMENT_RECORDED",
        title: "Payment confirmation required",
        message: `${fromMember.name} says they paid you ${amountFormatted} via ${methodLabel}. Please confirm or reject this settlement.`,
        relatedSettlementId: settlement.id,
      },
    });

    // Mock email notification to receiver
    if (toMember.user?.email) {
      await sendSettlementNotification({
        recipientEmail: toMember.user.email,
        recipientName: toMember.name,
        payerName: fromMember.name,
        receiverName: toMember.name,
        amount: amountFormatted,
        currency,
        paymentMethod: paymentMethod ?? "CASH",
        groupName: group.name,
        settlementId: settlement.id,
        requiresConfirmation: true,
      });
    }

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("[POST /api/groups/[groupId]/settlements]", error);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
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
