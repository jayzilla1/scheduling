import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Day, Shift, Staff } from "./types";

export interface Session {
  email: string;
  isAdmin: boolean;
  staff: Staff[];
  shifts: Shift[];
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

  const [{ data: staffRows }, { data: shiftRows }, { data: profile }] = await Promise.all([
    supabase.from("staff").select("id, name, user_id"),
    supabase.from("shifts").select("staff_id, day, start_min, end_min"),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const staff: Staff[] = (staffRows ?? []).map((r) => ({ id: r.id, name: r.name }));
  const me = (staffRows ?? []).find((r) => r.user_id === user.id);
  const email = user.email ?? "";
  const isAdmin = profile?.role === "admin";
  const fallback = email.split("@")[0];

  return {
    email,
    isAdmin,
    staff,
    shifts: (shiftRows ?? []).map((r) => ({
      staffId: r.staff_id,
      day: r.day as Day,
      start: r.start_min,
      end: r.end_min,
    })),
    myStaffId: me?.id ?? null,
    displayName: me?.name ?? (fallback ? fallback[0].toUpperCase() + fallback.slice(1) : "there"),
  };
}

export const isDay = (v: unknown): v is Day =>
  typeof v === "string" && ["mon", "tue", "wed", "thu", "fri"].includes(v);

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
