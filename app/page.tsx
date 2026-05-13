import Link from "next/link";
import { ArrowRight, Zap, Shield, Calculator, Users, Mail } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen mesh-bg grain relative overflow-hidden">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="font-display font-bold text-sm text-emerald-950">P</span>
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">Pocket</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-sm text-emerald-400 mb-8 animate-fade-in">
          <Zap className="w-3.5 h-3.5" />
          Cleaner than Splitwise. Smarter settlements.
        </div>

        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-slide-in">
          Split expenses.
          <br />
          <span className="text-emerald-400">Settle smart.</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-in [animation-delay:100ms]">
          Pocket tracks shared expenses between roommates, calculates who owes whom,
          and minimizes the number of transactions needed to settle up — no more
          tangled IOUs.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-in [animation-delay:200ms]">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Calculator,
              title: "Minimum transactions",
              desc: "Our greedy netting algorithm eliminates unnecessary payments between roommates.",
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              icon: Shield,
              title: "Tamper-proof audit trail",
              desc: "Every expense, edit, and settlement is logged with a timestamp.",
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              icon: Users,
              title: "Username search",
              desc: "Invite roommates by searching their unique username — no guessing emails.",
              color: "text-purple-400",
              bg: "bg-purple-500/10",
            },
            {
              icon: Mail,
              title: "Email invitations",
              desc: "Group invites are sent directly to your roommate's Gmail — accepted in one click.",
              color: "text-yellow-400",
              bg: "bg-yellow-500/10",
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div
              key={title}
              className="glass rounded-2xl p-6 hover:bg-white/[0.04] transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-display font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Built with Next.js · Prisma · NextAuth · Tailwind ·{" "}
          <span className="text-emerald-500/70">Pocket</span>
        </p>
      </footer>
    </div>
  );
}

