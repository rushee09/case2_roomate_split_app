import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendGroupInviteEmail } from "@/lib/mail";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitations = await db.groupInvitation.findMany({
    where: { invitedUserId: session.user.id, status: "PENDING" },
    include: {
      group: { select: { id: true, name: true } },
      invitedBy: { select: { username: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invitations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { groupId, username } = body;
  if (!groupId || !username) {
    return NextResponse.json({ error: "groupId and username are required" }, { status: 400 });
  }

  // Verify sender is a member of the group
  const member = await db.member.findFirst({
    where: { groupId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Not a group member" }, { status: 403 });

  const invitee = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!invitee) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check already a member
  const alreadyMember = await db.member.findFirst({ where: { groupId, userId: invitee.id } });
  if (alreadyMember) return NextResponse.json({ error: "User is already in this group" }, { status: 409 });

  // Check pending invite exists
  const existing = await db.groupInvitation.findFirst({
    where: { groupId, invitedUserId: invitee.id, status: "PENDING" },
  });
  if (existing) return NextResponse.json({ error: "Invitation already sent" }, { status: 409 });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const inviter = await db.user.findUnique({ where: { id: session.user.id } });
  const group = await db.group.findUnique({ where: { id: groupId } });

  const invitation = await db.groupInvitation.create({
    data: {
      groupId,
      invitedById: session.user.id,
      invitedEmail: invitee.email,
      invitedUserId: invitee.id,
      token,
      expiresAt,
    },
  });

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${token}`;
  try {
    await sendGroupInviteEmail({
      to: invitee.email,
      inviterName: inviter?.name ?? inviter?.username ?? "Someone",
      groupName: group?.name ?? "a group",
      acceptUrl,
    });
  } catch (e) {
    console.error("[invite] email failed", e);
  }

  return NextResponse.json(invitation, { status: 201 });
}
