"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Plus,
  Users,
  Receipt,
  BarChart2,
  Clock,
  Copy,
  Check,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { formatCurrencyShort } from "@/lib/money";
import { AddExpenseModal } from "@/components/AddExpenseModal";
import { AddMemberModal } from "@/components/AddMemberModal";
import { BalancesTab } from "@/components/BalancesTab";
import { ExpensesTab } from "@/components/ExpensesTab";
import { ActivityTab } from "@/components/ActivityTab";

type Tab = "overview" | "expenses" | "balances" | "activity";

interface Member {
  id: string;
  name: string;
  email?: string;
  userId?: string | null;
  user?: { username?: string | null } | null;
}

interface ExpenseSplit {
  memberId: string;
  amountPaise: number;
  percentage?: number;
  member: Member;
}

interface Expense {
  id: string;
  title: string;
  amountPaise: number;
  date: string;
  category?: string;
  notes?: string;
  splitType: "EQUAL" | "PERCENTAGE" | "EXACT";
  isRecurring: boolean;
  recurringPeriod?: string;
  paidBy: Member;
  splits: ExpenseSplit[];
}

interface Settlement {
  id: string;
  amountPaise: number;
  createdAt: string;
  fromMember: Member;
  toMember: Member;
}

interface Group {
  id: string;
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}

export default function GroupPage() {
  const params = useParams();
  const groupId = params.groupId as string;
  const router = useRouter();
  const { data: session } = useSession();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (res.status === 404) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setGroup(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, router]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  function refresh() {
    setRefreshing(true);
    fetchGroup();
  }

  function copyInviteCode() {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!group) return null;

  const totalSpend = group.expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  const currentMemberId = group.members.find(
    (m) => m.userId === (session?.user as any)?.id
  )?.id;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "balances", label: "Balances", icon: Users },
    { id: "activity", label: "Activity", icon: Clock },
  ];

  return (
    <div className="min-h-screen mesh-bg">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <a
              href={`/api/groups/${groupId}/export`}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors"
              title="Export CSV"
              download
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Group header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-display font-bold text-2xl shrink-0">
            {group.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-bold truncate">{group.name}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm text-muted-foreground">
                {group.members.length} member{group.members.length !== 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <button
                onClick={copyInviteCode}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
              >
                <code className="font-mono text-emerald-400 text-xs bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {group.inviteCode}
                </code>
                {codeCopied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Member
            </button>
            <button
              onClick={() => setShowAddExpense(true)}
              className="inline-flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Expense
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Total Spend"
            value={formatCurrencyShort(totalSpend, group.currency)}
            accent
          />
          <StatCard label="Members" value={group.members.length.toString()} />
          <StatCard label="Expenses" value={group.expenses.length.toString()} />
          <StatCard label="Settlements" value={group.settlements.length.toString()} />
        </div>

        {/* Tabs */}
        <div className="border-b border-white/5 mb-6">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? "border-emerald-500 text-white"
                    : "border-transparent text-muted-foreground hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab group={group} onAddExpense={() => setShowAddExpense(true)} />
        )}
        {activeTab === "expenses" && (
          <ExpensesTab
            expenses={group.expenses}
            currency={group.currency}
            groupId={groupId}
            onExpenseDeleted={fetchGroup}
          />
        )}
        {activeTab === "balances" && (
          <BalancesTab
            groupId={groupId}
            currency={group.currency}
            members={group.members}
            currentMemberId={currentMemberId}
            onSettled={fetchGroup}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab groupId={groupId} currency={group.currency} />
        )}
      </main>

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          groupId={groupId}
          members={group.members}
          currency={group.currency}
          onClose={() => setShowAddExpense(false)}
          onAdded={fetchGroup}
        />
      )}
      {showAddMember && (
        <AddMemberModal
          groupId={groupId}
          onClose={() => setShowAddMember(false)}
          onAdded={fetchGroup}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <p className={`font-display font-bold text-xl ${accent ? "text-emerald-400" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function OverviewTab({
  group,
  onAddExpense,
}: {
  group: Group;
  onAddExpense: () => void;
}) {
  const recent = group.expenses.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Members */}
      <div>
        <h3 className="font-display font-semibold mb-3">Members</h3>
        <div className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                {(m.user?.username ?? m.name).charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{m.user?.username ?? m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold">Recent Expenses</h3>
          {recent.length === 0 && (
            <button
              onClick={onAddExpense}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add first expense
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="glass rounded-xl py-12 text-center">
            <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No expenses yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((expense) => (
              <div
                key={expense.id}
                className="glass rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs shrink-0">
                    {categoryEmoji(expense.category)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{expense.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Paid by {expense.paidBy.name} ·{" "}
                      <span className={splitTypeBadge(expense.splitType)}>
                        {expense.splitType}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="font-mono text-sm font-semibold shrink-0">
                  {formatCurrencyShort(expense.amountPaise, group.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function categoryEmoji(category?: string | null): string {
  const map: Record<string, string> = {
    Food: "🍔",
    Utilities: "⚡",
    Housing: "🏠",
    Transport: "🚗",
    Entertainment: "🎬",
    Health: "💊",
    Shopping: "🛍️",
  };
  return category ? (map[category] ?? "💰") : "💰";
}

function splitTypeBadge(type: string): string {
  const map: Record<string, string> = {
    EQUAL: "text-blue-400",
    PERCENTAGE: "text-purple-400",
    EXACT: "text-yellow-400",
  };
  return map[type] ?? "";
}
