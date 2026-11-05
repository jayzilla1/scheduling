import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";
import type { Shift, Staff } from "@/lib/schedule/types";
import { checkStaffRules, findCoverageGaps } from "@/lib/schedule/rules";
import { fmt } from "@/lib/schedule/time";
import { DAYS, DAY_LABELS } from "@/lib/schedule/types";

async function Schedule() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: staffRows }, { data: shiftRows }, { data: profile }] = await Promise.all([
    supabase.from("staff").select("id, name"),
    supabase.from("shifts").select("staff_id, day, start_min, end_min"),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  const STAFF: Staff[] = staffRows ?? [];
  const shifts: Shift[] = (shiftRows ?? []).map((r) => ({
    staffId: r.staff_id,
    day: r.day,
    start: r.start_min,
    end: r.end_min,
  }));
  const gaps = findCoverageGaps(shifts);
  const violations = checkStaffRules(shifts);
  const name = (id: string) => STAFF.find((s) => s.id === id)?.name ?? id;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Weekly Schedule</h1>
      <div className="mb-6 flex items-center justify-between text-sm text-gray-500">
        <span>
          Signed in as {user.email}
          {profile?.role === "admin" ? " (admin)" : ""}
        </span>
        <form action={logout}>
          <button className="underline">Sign out</button>
        </form>
      </div>

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

export default function Home() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-500">Loading…</p>}>
      <Schedule />
    </Suspense>
  );
}
