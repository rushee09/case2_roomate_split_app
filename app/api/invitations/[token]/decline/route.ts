import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/invitations/[token]/decline
export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitation = await db.groupInvitation.findUnique({ where: { token: params.token } });
  if (!invitation || invitation.invitedUserId !== session.user.id) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
  }

  await db.groupInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED" } });
  return NextResponse.json({ ok: true });
}
