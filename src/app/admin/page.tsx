import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame, DayStrip, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { first, getSession, isDay } from "@/lib/schedule/queries";
import { checkStaffRules, findCoverageGaps } from "@/lib/schedule/rules";
import { fmtRange, toInput } from "@/lib/schedule/time";
import { getNow } from "@/lib/schedule/today";
import { DAY_LABELS, type Day } from "@/lib/schedule/types";
import { deleteShift, moveGiannaDay, saveShift } from "./actions";

const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-(--accent)";

async function Editor({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const sp = await searchParams;
  const s = await getSession();
  if (!s.isAdmin) redirect("/");
  const now = getNow();

  const day: Day = isDay(first(sp.day)) ? (first(sp.day) as Day) : (now.day ?? "mon");
  const error = first(sp.error);

  // Need row ids for editing, so fetch them with the shifts for this day.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("shifts").select("id, staff_id, start_min, end_min").eq("day", day).order("start_min");

  const violations = checkStaffRules(s.shifts);
  const gaps = findCoverageGaps(s.shifts);
  const giannaOnTue = s.shifts.some((x) => x.staffId === "gianna" && x.day === "tue");

  return (
    <AppFrame isAdmin name={s.displayName} active="edit">
      <h1 className="mb-1 text-2xl font-semibold">Edit schedule</h1>
      <p className="mb-5 text-sm text-muted">Changes save right away and everyone sees them.</p>

      {error && <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      <DayStrip selected={day} dates={now.dates} today={now.day} hrefFor={(d) => `/admin?day=${d}`} />

      {(violations.length > 0 || gaps.length > 0) && (
        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-1 font-semibold">Needs attention this week</p>
          {violations.map((v, i) => <p key={i}>• {v.message}</p>)}
          {gaps.map((g, i) => (
            <p key={i}>• {DAY_LABELS[g.day]}: only {g.have} {g.have === 1 ? "person" : "people"} {fmtRange(g.start, g.end)}</p>
          ))}
        </section>
      )}

      <SectionTitle>{DAY_LABELS[day]} shifts</SectionTitle>
      <ul className="space-y-3">
        {(rows ?? []).length === 0 && <li className="rounded-3xl bg-white p-4 text-sm text-muted">No shifts yet.</li>}
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-3xl bg-white p-4">
            <form action={saveShift} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="day" value={day} />
              <select name="staff_id" defaultValue={r.staff_id} className={`${field} col-span-2`}>
                {s.staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="time" name="start" defaultValue={toInput(r.start_min)} className={field} required />
              <input type="time" name="end" defaultValue={toInput(r.end_min)} className={field} required />
              <button className="rounded-xl bg-ink py-2 text-sm font-medium text-white">Save</button>
              <button formAction={deleteShift} formNoValidate className="rounded-xl bg-rose-50 py-2 text-sm font-medium text-rose-700">
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <SectionTitle>Add a shift</SectionTitle>
      <form action={saveShift} className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4">
        <input type="hidden" name="day" value={day} />
        <select name="staff_id" className={`${field} col-span-2`} defaultValue="">
          <option value="" disabled>Who&apos;s working?</option>
          {s.staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="time" name="start" className={field} required />
        <input type="time" name="end" className={field} required />
        <button className="col-span-2 rounded-xl bg-(--accent) py-2.5 text-sm font-semibold text-[#171a3d]">
          Add shift to {DAY_LABELS[day]}
        </button>
      </form>

      <SectionTitle>Gianna&apos;s third day</SectionTitle>
      <form action={moveGiannaDay} className="flex gap-2 rounded-3xl bg-white p-4">
        {(["tue", "thu"] as const).map((d) => {
          const on = d === "tue" ? giannaOnTue : !giannaOnTue;
          return (
            <button
              key={d}
              name="target"
              value={d}
              className={`flex-1 rounded-xl py-2 text-sm font-medium ${on ? "bg-ink text-white" : "bg-(--accent-soft)"}`}
            >
              {DAY_LABELS[d]}
            </button>
          );
        })}
      </form>
      <p className="mt-2 text-xs text-muted">Mon &amp; Wed are fixed. Pick Tuesday or Thursday for the busier week.</p>
    </AppFrame>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <Editor searchParams={props.searchParams} />
    </Suspense>
  );
}
