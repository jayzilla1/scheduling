import Link from "next/link";
import { Suspense } from "react";
import { Avatar, AppFrame, Pill } from "@/components/ui";
import { colorFor } from "@/lib/schedule/colors";
import { getSession } from "@/lib/schedule/queries";
import { findCoverageGaps } from "@/lib/schedule/rules";
import { fmtRange } from "@/lib/schedule/time";
import { getNow } from "@/lib/schedule/today";
import { DAYS, DAY_LABELS } from "@/lib/schedule/types";

async function Week() {
  const s = await getSession();
  const now = getNow();
  const gaps = findCoverageGaps(s.shifts);
  const nameOf = (id: string) => s.staff.find((x) => x.id === id)?.name ?? id;

  return (
    <AppFrame isAdmin={s.isAdmin} name={s.displayName} active="week">
      <h1 className="mb-1 text-2xl font-semibold">This week</h1>
      <p className="mb-5 text-sm text-muted">Tap a day to see it in detail.</p>

      <ul className="space-y-3">
        {DAYS.map((d) => {
          const dayShifts = s.shifts.filter((x) => x.day === d);
          const ids = [...new Set(dayShifts.map((x) => x.staffId))];
          const dayGaps = gaps.filter((g) => g.day === d);
          return (
            <li key={d}>
              <Link
                href={`/?day=${d}`}
                className={`block rounded-3xl bg-white p-4 ${d === now.day ? "ring-2 ring-(--accent)" : ""}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{DAY_LABELS[d]}</p>
                    <p className="text-xs text-muted">{now.monthLabel} {now.dates[d]}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 whitespace-nowrap">
                    {d === now.day && <Pill tone="ok">Today</Pill>}
                    {s.isAdmin && dayGaps.length > 0 && <Pill tone="warn">Short-staffed</Pill>}
                  </div>
                </div>
                {ids.length === 0 ? (
                  <p className="text-sm text-muted">No one scheduled</p>
                ) : (
                  <ul className="space-y-2">
                    {ids.map((id) => {
                      const c = colorFor(id);
                      return (
                        <li key={id} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm" style={{ background: c.bg, color: c.fg }}>
                          <Avatar id={id} name={nameOf(id)} size={28} />
                          <span className="font-semibold">{nameOf(id)}</span>
                          <span className="ml-auto flex flex-col text-right leading-snug opacity-80">
                            {dayShifts
                              .filter((x) => x.staffId === id)
                              .sort((a, b) => a.start - b.start)
                              .map((x, i) => (
                                <span key={i} className="whitespace-nowrap">{fmtRange(x.start, x.end)}</span>
                              ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </AppFrame>
  );
}

export default function WeekPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <Week />
    </Suspense>
  );
}
