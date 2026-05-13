import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const users = await db.user.findMany({
    where: {
      username: { contains: q },
      NOT: { id: session.user.id },
    },
    select: { id: true, username: true, name: true, image: true, email: true },
    take: 10,
  });

  return NextResponse.json(users);
}
