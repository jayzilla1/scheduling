import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, mondayOf } from "./dates";
import { effectiveWeek } from "./effective";
import { getNow, type Now } from "./today";
import type { Day, EventRow, ScheduleChange, Shift, Staff } from "./types";

export interface Session {
  email: string;
  isAdmin: boolean;
  staff: Staff[];
  /** the weekly template */
  shifts: Shift[];
  /** one-day changes for the current week */
  changes: ScheduleChange[];
  /** events this week (admin only; empty for everyone else) */
  events: EventRow[];
  /** what actually happens this week: template + changes */
  effective: Shift[];
  now: Now;
  /** the staff member this login belongs to, if linked */
  myStaffId: string | null;
  displayName: string;
}

/** Loads who's logged in plus the whole schedule. Redirects to /login if signed out. */
export async function getSession(): Promise<Session> {
  await connection(); // always rendered at request time (depends on the logged-in user and the clock)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = getNow();
  const monday = now.isoDates.mon;
  const friday = now.isoDates.fri;

  const [{ data: staffRows }, { data: shiftRows }, { data: profile }, { data: changeRows }] = await Promise.all([
    supabase.from("staff").select("id, name, user_id"),
    supabase.from("shifts").select("staff_id, day, start_min, end_min"),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("schedule_changes")
      .select("id, kind, staff_id, date, start_min, end_min, event_id")
      .gte("date", monday)
      .lte("date", friday),
  ]);

  const staff: Staff[] = (staffRows ?? []).map((r) => ({ id: r.id, name: r.name }));
  const me = (staffRows ?? []).find((r) => r.user_id === user.id);
  const email = user.email ?? "";
  const isAdmin = profile?.role === "admin";
  const fallback = email.split("@")[0];

  const shifts: Shift[] = (shiftRows ?? []).map((r) => ({
    staffId: r.staff_id,
    day: r.day as Day,
    start: r.start_min,
    end: r.end_min,
  }));
  const changes: ScheduleChange[] = (changeRows ?? []).map(toChange);

  let events: EventRow[] = [];
  if (isAdmin) {
    const { data: eventRows } = await supabase
      .from("events")
      .select("id, title, person, date, start_min, end_min")
      .gte("date", monday)
      .lte("date", friday);
    events = (eventRows ?? []).map(toEvent);
  }

  return {
    email,
    isAdmin,
    staff,
    shifts,
    changes,
    events,
    effective: effectiveWeek(monday, shifts, changes),
    now,
    myStaffId: me?.id ?? null,
    displayName: me?.name ?? (fallback ? fallback[0].toUpperCase() + fallback.slice(1) : "there"),
  };
}

export const isDay = (v: unknown): v is Day =>
  typeof v === "string" && ["mon", "tue", "wed", "thu", "fri"].includes(v);

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

interface ChangeRow { kind: string; staff_id: string; date: string; start_min: number; end_min: number; event_id: number | null }
interface EventDbRow { id: number; title: string; person: string; date: string; start_min: number; end_min: number }

export const toChange = (r: ChangeRow): ScheduleChange => ({
  kind: r.kind === "remove" ? "remove" : "add",
  staffId: r.staff_id,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
  eventId: r.event_id,
});

export const toEvent = (r: EventDbRow): EventRow => ({
  id: r.id,
  title: r.title,
  person: r.person,
  date: r.date,
  start: r.start_min,
  end: r.end_min,
});

/** Everything needed to evaluate one specific date: template, staff, that week's changes and events. */
export async function loadWeekContext(supabase: SupabaseClient, date: string) {
  const monday = mondayOf(date);
  const friday = addDays(monday, 4);
  const [{ data: staffRows }, { data: shiftRows }, { data: changeRows }, { data: eventRows }] = await Promise.all([
    supabase.from("staff").select("id, name"),
    supabase.from("shifts").select("staff_id, day, start_min, end_min"),
    supabase.from("schedule_changes").select("id, kind, staff_id, date, start_min, end_min, event_id").gte("date", monday).lte("date", friday),
    supabase.from("events").select("id, title, person, date, start_min, end_min").gte("date", monday).lte("date", friday),
  ]);
  return {
    staff: (staffRows ?? []).map((r) => ({ id: r.id as string, name: r.name as string })) as Staff[],
    template: (shiftRows ?? []).map((r) => ({ staffId: r.staff_id, day: r.day as Day, start: r.start_min, end: r.end_min })) as Shift[],
    changes: (changeRows ?? []).map(toChange),
    events: (eventRows ?? []).map(toEvent),
  };
}
