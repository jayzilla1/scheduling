"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DAYS, type Day } from "@/lib/schedule/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") redirect("/");
  return supabase;
}

const toMin = (v: FormDataEntryValue | null) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

function back(day: string, error?: string): never {
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/admin");
  redirect(`/admin?day=${day}${error ? `&error=${encodeURIComponent(error)}` : ""}`);
}

function readShift(fd: FormData) {
  const day = String(fd.get("day"));
  const staffId = String(fd.get("staff_id") ?? "");
  const start = toMin(fd.get("start"));
  const end = toMin(fd.get("end"));
  if (!DAYS.includes(day as Day)) back("mon", "Pick a valid day.");
  if (!staffId) back(day, "Pick who is working.");
  if (Number.isNaN(start) || Number.isNaN(end)) back(day, "Enter a start and end time.");
  if (end <= start) back(day, "End time must be after the start time.");
  return { day, staff_id: staffId, start_min: start, end_min: end };
}

export async function saveShift(fd: FormData) {
  const supabase = await requireAdmin();
  const row = readShift(fd);
  const id = fd.get("id");
  const { error } = id
    ? await supabase.from("shifts").update(row).eq("id", Number(id))
    : await supabase.from("shifts").insert(row);
  back(row.day, error?.message);
}

export async function deleteShift(fd: FormData) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("shifts").delete().eq("id", Number(fd.get("id")));
  back(String(fd.get("day") ?? "mon"), error?.message);
}

/** Moves Gianna's flexible third day between Tuesday and Thursday. */
export async function moveGiannaDay(fd: FormData) {
  const supabase = await requireAdmin();
  const target = String(fd.get("target"));
  const other = target === "tue" ? "thu" : "tue";
  if (target !== "tue" && target !== "thu") back("mon", "Invalid day.");

  const { data: existing } = await supabase
    .from("shifts").select("id").eq("staff_id", "gianna").eq("day", target);
  if (!existing?.length) {
    const { data: moved, error } = await supabase
      .from("shifts").update({ day: target }).eq("staff_id", "gianna").eq("day", other).select("id");
    if (error) back(target, error.message);
    if (!moved?.length) {
      const { error: e2 } = await supabase
        .from("shifts").insert({ staff_id: "gianna", day: target, start_min: 900, end_min: 1050 });
      back(target, e2?.message);
    }
  }
  back(target);
}
