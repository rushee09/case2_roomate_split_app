import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CreateSettlementSchema } from "@/lib/validations";

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

// POST /api/groups/[groupId]/settlements — record a settle-up
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

    const { fromMemberId, toMemberId, amountPaise, note } = parsed.data;

    // Verify both members belong to this group
    const [fromMember, toMember] = await Promise.all([
      db.member.findFirst({ where: { id: fromMemberId, groupId: params.groupId } }),
      db.member.findFirst({ where: { id: toMemberId, groupId: params.groupId } }),
    ]);

    if (!fromMember || !toMember) {
      return NextResponse.json(
        { error: "One or both members are not part of this group" },
        { status: 400 }
      );
    }

    if (fromMemberId === toMemberId) {
      return NextResponse.json(
        { error: "Payer and receiver cannot be the same member" },
        { status: 400 }
      );
    }

    const settlement = await db.settlement.create({
      data: {
        groupId: params.groupId,
        fromMemberId,
        toMemberId,
        amountPaise,
        note: note || null,
      },
      include: { fromMember: true, toMember: true },
    });

    // Audit log — settlement is a real, permanent record
    await db.activity.create({
      data: {
        groupId: params.groupId,
        type: "SETTLEMENT_COMPLETED",
        data: JSON.stringify({
          settlementId: settlement.id,
          fromMemberName: fromMember.name,
          toMemberName: toMember.name,
          amountPaise,
        }),
      },
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("[POST /api/groups/[groupId]/settlements]", error);
    return NextResponse.json({ error: "Failed to record settlement" }, { status: 500 });
  }
}
