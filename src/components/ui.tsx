import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { colorFor } from "@/lib/schedule/colors";
import { fmtRange } from "@/lib/schedule/time";
import { DAYS, DAY_LABELS, type Day, type Shift } from "@/lib/schedule/types";

/* ---------- icons ---------- */
const icon = "h-6 w-6";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export const SunIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} {...stroke}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const CalIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} {...stroke}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
);
export const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} {...stroke}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></svg>
);
export const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className={icon} {...stroke}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);

/* ---------- avatar ---------- */
export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, background: colorFor(id).dot, fontSize: size * 0.42 }}
      aria-label={name}
    >
      {name[0]}
    </span>
  );
}

/* ---------- app frame: header + bottom nav ---------- */
export type NavKey = "today" | "week" | "events" | "edit";

export function AppFrame({
  isAdmin, name, active, children,
}: { isAdmin: boolean; name: string; active: NavKey; children: ReactNode }) {
  const items: { key: NavKey; href: string; label: string; icon: ReactNode }[] = [
    { key: "today", href: "/", label: "Today", icon: <SunIcon /> },
    { key: "week", href: "/week", label: "Week", icon: <CalIcon /> },
    ...(isAdmin
      ? [
          { key: "events" as const, href: "/events", label: "Events", icon: <SparkIcon /> },
          { key: "edit" as const, href: "/admin", label: "Edit", icon: <PencilIcon /> },
        ]
      : []),
  ];

  return (
    <div data-role={isAdmin ? "admin" : "staff"} className="mx-auto min-h-dvh max-w-xl overflow-x-clip pb-32">
      <header
        className="flex items-center justify-between rounded-b-[2rem] bg-white px-6 pb-5 pt-6 shadow-[0_8px_30px_rgba(31,35,48,0.05)]"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">Daycare Schedule</span>
          {isAdmin && (
            <span className="rounded-full bg-(--accent) px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-(--on-accent)">
              Admin
            </span>
          )}
        </div>
        <form action={logout}>
          <button
            className="text-xs font-medium text-muted underline-offset-4 hover:underline"
            title={`Signed in as ${name}`}
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="px-6 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl rounded-t-[2rem] bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(29,33,64,0.08)]">
        <ul className="flex justify-around">
          {items.map((it) => {
            const on = it.key === active;
            return (
              <li key={it.key}>
                <Link
                  href={it.href}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-5 py-2 text-[11px] font-medium transition ${
                    on ? "bg-(--accent-soft) text-ink" : "text-muted"
                  }`}
                >
                  <span className={on ? "text-ink" : ""}>{it.icon}</span>
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/* ---------- Mon-Fri strip ---------- */
export function DayStrip({
  selected, dates, today, hrefFor, dotDays = [],
}: {
  selected: Day;
  dates: Record<Day, number>;
  today: Day | null;
  hrefFor: (d: Day) => string;
  dotDays?: Day[];
}) {
  return (
    <ol className="grid grid-cols-5 gap-2">
      {DAYS.map((d) => {
        const on = d === selected;
        return (
          <li key={d}>
            <Link
              href={hrefFor(d)}
              scroll={false}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-3 transition ${
                on ? "bg-(--accent) text-(--on-accent) shadow-lg shadow-(--accent)/30" : "bg-white text-ink"
              }`}
            >
              <span className={`text-[11px] font-medium ${on ? "text-(--on-accent)/70" : "text-muted"}`}>
                {DAY_LABELS[d].slice(0, 3)}
              </span>
              <span className="text-lg font-semibold leading-tight">{dates[d]}</span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  d === today ? "bg-rose-500" : dotDays.includes(d) ? (on ? "bg-white/70" : "bg-(--accent)") : "bg-transparent"
                }`}
              />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- a single shift ---------- */
export function ShiftCard({
  shift, name, live,
}: { shift: Shift; name: string; live?: boolean }) {
  const c = colorFor(shift.staffId);
  return (
    <li className="flex items-center gap-3 rounded-3xl p-4" style={{ background: c.bg, color: c.fg }}>
      <Avatar id={shift.staffId} name={name} size={44} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-sm opacity-80">{fmtRange(shift.start, shift.end)}</p>
      </div>
      {live && (
        <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Here now
        </span>
      )}
    </li>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="text-base font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "calm"; children: ReactNode }) {
  const styles = {
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    calm: "bg-white text-muted",
  }[tone];
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles}`}>{children}</span>;
}
