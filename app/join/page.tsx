"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2, Users } from "lucide-react";

interface GroupPreview {
  id: string;
  name: string;
  currency: string;
  memberCount: number;
  inviteCode: string;
}

function JoinPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const prefilledCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(prefilledCode.toUpperCase());
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login?callbackUrl=/join");
  }, [status, router]);

  useEffect(() => {
    if (prefilledCode) lookupCode(prefilledCode.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupCode(c: string) {
    if (c.length < 4) { setPreview(null); return; }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res = await fetch(`/api/join?code=${c}`);
      if (!res.ok) {
        setPreview(null);
        setPreviewError("Group not found. Check the invite code.");
      } else {
        const data = await res.json();
        setPreview(data);
      }
    } catch {
      setPreviewError("Network error.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    setCode(val);
    if (val.length >= 4) lookupCode(val);
    else { setPreview(null); setPreviewError(""); }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;

    setJoining(true);
    setJoinError("");

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.groupId) { router.push(`/groups/${data.groupId}`); return; }
        setJoinError(data.error ?? "Failed to join group");
        return;
      }

      const data = await res.json();
      router.push(`/groups/${data.group.id}`);
    } catch {
      setJoinError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold mb-1">Join a Group</h1>
            <p className="text-sm text-muted-foreground">
              Enter the invite code shared by a group member.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="code">
                Invite Code
              </label>
              <input
                id="code"
                type="text"
                placeholder="e.g. FLAT12"
                value={code}
                onChange={handleCodeChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono uppercase placeholder:text-muted-foreground placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors tracking-widest"
                required
              />

              {previewLoading && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Looking up group…
                </div>
              )}
              {previewError && (
                <p className="mt-2 text-xs text-red-400">{previewError}</p>
              )}
              {preview && (
                <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center font-display font-bold text-emerald-400">
                      {preview.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{preview.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {preview.memberCount} member{preview.memberCount !== 1 ? "s" : ""}
                        &nbsp;·&nbsp;{preview.currency}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {joinError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {joinError}
              </p>
            )}

            <button
              type="submit"
              disabled={joining || !code || !!previewError}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-950 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Joining…
                </>
              ) : (
                "Join Group"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  );
}

