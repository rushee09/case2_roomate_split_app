import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/groups/[groupId]/activity
export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const activities = await db.activity.findMany({
      where: { groupId: params.groupId },
      orderBy: { createdAt: "desc" },
      take: 100, // limit to last 100 events
    });

    const parsed = activities.map((a) => ({
      ...a,
      data: JSON.parse(a.data),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[GET /api/groups/[groupId]/activity]", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
