import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/invitations/[token]/accept
export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitation = await db.groupInvitation.findUnique({
    where: { token: params.token },
    include: { group: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 410 });
  }
  if (new Date() > invitation.expiresAt) {
    await db.groupInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }
  if (invitation.invitedUserId && invitation.invitedUserId !== session.user.id) {
    return NextResponse.json({ error: "This invitation is for a different user" }, { status: 403 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already a member
  const alreadyMember = await db.member.findFirst({
    where: { groupId: invitation.groupId, userId: session.user.id },
  });

  if (!alreadyMember) {
    await db.$transaction([
      db.member.create({
        data: {
          name: user.name ?? user.username,
          email: user.email,
          groupId: invitation.groupId,
          userId: user.id,
        },
      }),
      db.activity.create({
        data: {
          groupId: invitation.groupId,
          type: "MEMBER_JOINED",
          data: JSON.stringify({ memberName: user.name ?? user.username }),
        },
      }),
    ]);
  }

  await db.groupInvitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });

  return NextResponse.json({ ok: true, groupId: invitation.groupId });
}
