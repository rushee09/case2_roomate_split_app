"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [state, setState] = useState<"loading" | "idle" | "accepting" | "declining" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);

  // If not authenticated, redirect to login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=/invitations/${params.token}`);
    } else if (status === "authenticated") {
      setState("idle");
    }
  }, [status, router, params.token]);

  async function handleAccept() {
    setState("accepting");
    try {
      const res = await fetch(`/api/invitations/${params.token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Failed to accept invitation");
        setState("error");
        return;
      }
      setGroupId(data.groupId);
      setState("done");
      setMessage("accepted");
    } catch {
      setMessage("Something went wrong.");
      setState("error");
    }
  }

  async function handleDecline() {
    setState("declining");
    try {
      await fetch(`/api/invitations/${params.token}/decline`, { method: "POST" });
      setState("done");
      setMessage("declined");
    } catch {
      setMessage("Something went wrong.");
      setState("error");
    }
  }

  if (state === "loading" || status === "loading") {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
          <span className="font-display font-bold text-base text-emerald-950">P</span>
        </div>
        <span className="font-display font-semibold text-xl tracking-tight">Pocket</span>
      </Link>

      <div className="glass rounded-2xl p-8 w-full max-w-sm text-center">
        {state === "done" && message === "accepted" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">You're in!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              You've successfully joined the group.
            </p>
            <Link
              href={groupId ? `/groups/${groupId}` : "/dashboard"}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400
                         text-emerald-950 font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Users className="w-4 h-4" />
              Go to Group
            </Link>
          </>
        )}

        {state === "done" && message === "declined" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Invitation declined</h2>
            <p className="text-muted-foreground text-sm mb-6">
              You've declined the group invitation.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10
                         text-white font-medium px-5 py-2.5 rounded-xl transition-colors
                         hover:bg-white/10"
            >
              Back to Dashboard
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Oops!</h2>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-white/5 border border-white/10
                         text-white font-medium px-5 py-2.5 rounded-xl transition-colors
                         hover:bg-white/10"
            >
              Back to Dashboard
            </Link>
          </>
        )}

        {state === "idle" && (
          <>
            <Users className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Group Invitation</h2>
            <p className="text-muted-foreground text-sm mb-6">
              You've been invited to join an expense group on Pocket.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDecline}
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10
                           text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950
                           font-semibold py-2.5 rounded-xl transition-colors"
              >
                Accept
              </button>
            </div>
          </>
        )}

        {(state === "accepting" || state === "declining") && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-muted-foreground text-sm">
              {state === "accepting" ? "Joining group..." : "Declining..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
