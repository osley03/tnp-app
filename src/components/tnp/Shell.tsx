import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export type Role = "TENANT" | "LANDLORD" | "ADMIN" | "SUPPORT";

const roleTone: Record<Role, string> = {
  TENANT: "text-terra ring-terra/30 bg-terra/15",
  LANDLORD: "text-ochre ring-ochre/30 bg-ochre/15",
  ADMIN: "text-clay ring-clay/30 bg-clay/15",
  SUPPORT: "text-emerald-300 ring-emerald-400/30 bg-emerald-400/10",
};

export function TopBar({
  role,
  who,
  back,
}: {
  role: Role;
  who: string;
  back?: { to: string; label: string };
}) {
  const tone = roleTone[role];

  return (
    <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-line bg-ink/90 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-wider text-mut">TNP · MUTUAL TRUST LEDGER</p>
          <h1 className="truncate font-display text-[13px] font-semibold tracking-tight">{who}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-md px-2 py-1 font-mono text-[9px] ring-1 ${tone}`}>{role}</span>
          <Link
            to="/"
            className="rounded-md bg-panel-2 px-2 py-1 font-mono text-[9px] text-mut ring-1 ring-line"
          >
            Switch
          </Link>
        </div>
      </div>
      {back && (
        <Link
          to={back.to}
          className="mt-2 inline-flex items-center gap-1 font-mono text-[9px] text-mut hover:text-fg"
        >
          ← {back.label}
        </Link>
      )}
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="tnp-module tnp-module-dark min-h-screen bg-ink text-[13px] leading-relaxed text-fg">
      <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">{children}</div>
    </main>
  );
}

export function Card({
  index,
  title,
  meta,
  children,
}: {
  index?: string;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-panel p-3 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {index && <span className="font-mono text-[9px] text-mut">({index})</span>}
          <span className="font-display text-[12px] font-semibold tracking-tight">{title}</span>
        </div>
        {meta && <span className="font-mono text-[9px] text-mut">{meta}</span>}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function TrustMeter({ score, label }: { score: number; label: string }) {
  const tone = score >= 85 ? "from-terra to-ochre" : score >= 70 ? "from-ochre to-ochre" : "from-clay to-clay";
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="font-display text-4xl leading-none font-bold tracking-tight">
          {score}
          <span className="text-xl text-mut">/100</span>
        </p>
        <span className="font-mono text-[9px] text-mut">{label}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2 ring-1 ring-line">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function Stat({ k, v, tone = "" }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-2.5 py-2 ring-1 ring-line">
      <p className="font-mono text-[9px] text-mut">{k}</p>
      <p className={`mt-0.5 font-display text-[12px] font-semibold ${tone}`}>{v}</p>
    </div>
  );
}

export function Avatar({ ini, tone }: { ini: string; tone: string }) {
  return (
    <div
      className={`grid size-9 shrink-0 place-items-center rounded-full font-display text-[11px] font-bold ring-1 ${tone}`}
    >
      {ini}
    </div>
  );
}
