import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

/**
 * Proxy a request to the FastAPI backend.
 * Injects x-user-id and x-username headers from the NextAuth session.
 */
export async function proxy(
  request: NextRequest,
  path: string,
  method?: string,
  params?: Record<string, string>,
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build URL including any query params
  const url = new URL(`${FASTAPI_URL}${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "x-user-id": session.user.id,
    "x-username": (session.user as any).username ?? "",
  };

  const reqMethod = method ?? request.method;
  let body: string | undefined;

  if (!["GET", "HEAD", "DELETE"].includes(reqMethod)) {
    try {
      const json = await request.json();
      body = JSON.stringify(json);
      headers["Content-Type"] = "application/json";
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(url.toString(), { method: reqMethod, headers, body });
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.includes("text/csv")) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": res.headers.get("Content-Disposition") ?? "",
        },
      });
    }

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[proxy] ${reqMethod} ${path}`, err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
