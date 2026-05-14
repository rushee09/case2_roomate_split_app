"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, AtSign, CheckCircle2, XCircle, LogOut } from "lucide-react";
import Link from "next/link";

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // If already has username, skip onboarding
  useEffect(() => {
    if (status === "authenticated" && (session.user as any).username) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  const validateUsername = (v: string) => /^[a-zA-Z0-9_]{3,20}$/.test(v);

  async function checkUsername(v: string) {
    if (!validateUsername(v)) { setAvailable(null); return; }
    setChecking(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(v)}`);
      const users = await res.json();
      setAvailable(!users.some((u: any) => u.username === v.toLowerCase()));
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateUsername(username) || available === false) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save username");
        setSaving(false);
        return;
      }
      await update(); // refresh session
      router.replace("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-10">
        <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
          <span className="font-display font-bold text-base text-emerald-950">P</span>
        </div>
        <span className="font-display font-semibold text-xl tracking-tight">Pocket</span>
      </Link>

      <div className="glass rounded-2xl p-8 w-full max-w-sm">
        {session?.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="w-14 h-14 rounded-full mx-auto mb-4 ring-2 ring-emerald-500/30"
          />
        )}
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold mb-1">
            Hey{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground text-sm">
            Choose a unique username so your roommates can find and invite you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
                  setUsername(v);
                  setAvailable(null);
                  clearTimeout((window as any)._usernameTimer);
                  if (v.length >= 3) {
                    (window as any)._usernameTimer = setTimeout(() => checkUsername(v), 500);
                  }
                }}
                placeholder="e.g. aakar_roomie"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5
                           text-sm placeholder:text-muted-foreground focus:outline-none
                           focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                           transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!checking && available === true && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {!checking && available === false && <XCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              3–20 characters: letters, numbers, underscores.
            </p>
            {available === false && (
              <p className="text-xs text-red-400 mt-1">Username is already taken.</p>
            )}
            {available === true && (
              <p className="text-xs text-emerald-400 mt-1">Username is available!</p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || !validateUsername(username) || available === false || checking}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold
                       py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Setting up..." : "Claim Username & Continue"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Signed in as{" "}
            <span className="text-white font-medium">{session?.user?.email}</span>
          </p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Wrong account? Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
