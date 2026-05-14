import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/notifications?memberId=xxx  — fetch unread + recent notifications
// OR  /api/notifications?userId=xxx   — aggregate across all member records for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberId = request.nextUrl.searchParams.get("memberId");
    const userId = request.nextUrl.searchParams.get("userId");

    let memberIds: string[] = [];

    if (memberId) {
      memberIds = [memberId];
    } else if (userId) {
      const members = await db.member.findMany({
        where: { userId },
        select: { id: true },
      });
      memberIds = members.map((m) => m.id);
    } else {
      return NextResponse.json({ error: "memberId or userId is required" }, { status: 400 });
    }

    if (memberIds.length === 0) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await db.notification.findMany({
      where: { recipientMemberId: { in: memberIds } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actorMember: { select: { id: true, name: true } },
        settlement: { select: { id: true, status: true, paymentMethod: true, amountPaise: true } },
        group: { select: { id: true, name: true } },
      },
    });

    const unreadCount = await db.notification.count({
      where: { recipientMemberId: { in: memberIds }, isRead: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// PATCH /api/notifications — mark notifications as read
// body: { ids: string[] } or { all: true, memberId: string }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (body.all && (body.memberId || body.userId)) {
      let memberIds: string[] = body.memberId ? [body.memberId] : [];
      if (body.userId && !body.memberId) {
        const members = await db.member.findMany({
          where: { userId: body.userId },
          select: { id: true },
        });
        memberIds = members.map((m: { id: string }) => m.id);
      }
      if (memberIds.length > 0) {
        await db.notification.updateMany({
          where: { recipientMemberId: { in: memberIds }, isRead: false },
          data: { isRead: true },
        });
      }
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await db.notification.updateMany({
        where: { id: { in: body.ids } },
        data: { isRead: true },
      });
    } else {
      return NextResponse.json({ error: "Provide ids[] or { all: true, memberId/userId }" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/notifications]", error);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }
}
