"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Plus, Users, Receipt, ArrowRight, Wallet, Bell, LogOut, Loader2 } from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";
import { NotificationBell } from "@/components/NotificationBell";

interface Group {
  id: string;
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: string;
  _count: { members: number; expenses: number };
}

interface Invitation {
  id: string;
  token: string;
  group: { id: string; name: string };
  invitedBy: { username: string; name: string | null };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      const user = session.user as any;
      if (!user?.username) {
        router.replace("/onboarding");
        return;
      }
      Promise.all([
        fetch("/api/groups").then((r) => r.json()),
        fetch("/api/invitations").then((r) => r.json()),
      ])
        .then(([g, inv]) => {
          setGroups(Array.isArray(g) ? g : []);
          setInvitations(Array.isArray(inv) ? inv : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status, session, router]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const user = session?.user as any;

  return (
    <div className="min-h-screen mesh-bg">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="font-display font-bold text-xs text-emerald-950">P</span>
            </div>
            <span className="font-display font-semibold tracking-tight">Pocket</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Group
            </Link>
            {user?.id && <NotificationBell userId={user.id} />}
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name ?? ""}
                className="w-8 h-8 rounded-full ring-1 ring-white/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                {(user?.name ?? user?.username ?? "U").charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-white"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* User greeting */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-1">
            Your Groups
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as{" "}
            <span className="text-white font-medium">@{user?.username}</span>
            {" · "}
            {groups.length === 0 && !loading
              ? "No groups yet — create one or join via invite code."
              : `${groups.length} group${groups.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Pending invitations banner */}
        {invitations.length > 0 && (
          <div className="glass border border-emerald-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-400 mb-2">
                  {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-2">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground truncate">
                        <span className="text-white font-medium">@{inv.invitedBy.username}</span>{" "}
                        invited you to <span className="text-white font-medium">{inv.group.name}</span>
                      </p>
                      <Link
                        href={`/invitations/${inv.token}`}
                        className="shrink-0 text-xs bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-3 py-1 rounded-lg transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Join group CTA */}
        <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Have an invite code?</p>
            <p className="text-xs text-muted-foreground">
              Join an existing group with a 6-character code.
            </p>
          </div>
          <Link
            href="/join"
            className="shrink-0 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Join Group
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-xl p-5 h-36 skeleton" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg mb-2">No groups yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Create your first expense group to get started.
            </p>
            <Link
              href="/groups/new"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="glass rounded-xl p-5 hover:bg-white/[0.05] transition-all hover:scale-[1.01] group block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-display font-bold text-lg">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display font-semibold mb-3 truncate">{group.name}</h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {group._count.members}
                  </span>
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    {group._count.expenses}
                  </span>
                  <span className="ml-auto text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
                    {group.inviteCode}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

