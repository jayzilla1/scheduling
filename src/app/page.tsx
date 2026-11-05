import { STAFF, buildTemplate } from "@/lib/schedule/data";
import { checkStaffRules, findCoverageGaps } from "@/lib/schedule/rules";
import { fmt } from "@/lib/schedule/time";
import { DAYS, DAY_LABELS } from "@/lib/schedule/types";

export default function Home() {
  const shifts = buildTemplate("thu");
  const gaps = findCoverageGaps(shifts);
  const violations = checkStaffRules(shifts);
  const name = (id: string) => STAFF.find((s) => s.id === id)?.name ?? id;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Weekly Schedule</h1>
      <p className="mb-6 text-sm text-gray-500">Preview with Pam&apos;s template (read-only for now)</p>

      {violations.length > 0 && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {violations.map((v, i) => (
            <p key={i}>{v.message}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-5">
        {DAYS.map((day) => (
          <section key={day} className="rounded border p-3">
            <h2 className="mb-2 font-semibold">{DAY_LABELS[day]}</h2>
            <ul className="space-y-1 text-sm">
              {shifts
                .filter((s) => s.day === day)
                .sort((a, b) => a.start - b.start)
                .map((s, i) => (
                  <li key={i}>
                    <span className="font-medium">{name(s.staffId)}</span>
                    <br />
                    <span className="text-gray-600">
                      {fmt(s.start)} – {fmt(s.end)}
                    </span>
                  </li>
                ))}
            </ul>
            {gaps
              .filter((g) => g.day === day)
              .map((g, i) => (
                <p key={i} className="mt-2 rounded bg-amber-50 p-1.5 text-xs text-amber-800">
                  Only {g.have} on {fmt(g.start)}–{fmt(g.end)}
                </p>
              ))}
          </section>
        ))}
      </div>
    </main>
  );
}
