"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiUnavailable, parseEventText } from "@/lib/ai/parseEvent";
import { isIsoDate } from "@/lib/schedule/dates";
import { loadWeekContext } from "@/lib/schedule/queries";
import { suggestPlans } from "@/lib/schedule/suggest";
import { getNow } from "@/lib/schedule/today";
import { createClient } from "@/lib/supabase/server";

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

const fail = (path: string, message: string): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);

function refresh() {
  revalidatePath("/");
  revalidatePath("/week");
  revalidatePath("/events");
}

/** Step 1 (AI): read Pam's sentence and prefill the event form. Nothing is saved yet. */
export async function draftFromText(fd: FormData) {
  const supabase = await requireAdmin();
  const text = String(fd.get("text") ?? "").trim();
  if (!text) fail("/events", "Type what's happening first.");

  const now = getNow();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${now.todayIso}T00:00:00Z`));
  const { data: staff } = await supabase.from("staff").select("id, name");

  let target: string;
  try {
    const d = await parseEventText(text, staff ?? [], now.todayIso, weekday);
    const q = new URLSearchParams({ title: d.title, person: d.person, date: d.date, start: d.start, end: d.end, ai: "1", note: d.assumptions });
    target = `/events?${q}`;
  } catch (e) {
    let msg = e instanceof Error ? e.message : "Something went wrong.";
    if (e instanceof AiUnavailable) msg = `${e.message} You can still fill in the form below.`;
    else if (e instanceof Anthropic.AuthenticationError) msg = "The AI key isn't valid. You can still use the form below.";
    else if (e instanceof Anthropic.RateLimitError) msg = "The AI is busy right now. Try again in a minute, or use the form below.";
    else if (e instanceof Anthropic.APIError) msg = "The AI couldn't be reached. You can still use the form below.";
    return fail("/events", msg);
  }
  redirect(target);
}

/** Step 2: save the event. If a staff member is away, their time off is removed for that day. */
export async function saveEvent(fd: FormData) {
  const supabase = await requireAdmin();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const person = String(fd.get("person") ?? "");
  const date = String(fd.get("date") ?? "");
  const start = toMin(fd.get("start"));
  const end = toMin(fd.get("end"));
  const back = `/events?${new URLSearchParams({ title, person, date, start: String(fd.get("start") ?? ""), end: String(fd.get("end") ?? "") })}`;

  if (!title) fail(back, "Give the event a short title.");
  if (!isIsoDate(date)) fail(back, "Pick a date.");
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) fail(back, "Enter a start time and a later end time.");

  if (person !== "pam") {
    const { data: s } = await supabase.from("staff").select("id").eq("id", person).maybeSingle();
    if (!s) fail(back, "Pick who is affected.");
  }

  const { data: ev, error } = await supabase
    .from("events")
    .insert({ title, person, date, start_min: start, end_min: end })
    .select("id")
    .single();
  if (error || !ev) return fail(back, error?.message ?? "Couldn't save the event.");

  if (person !== "pam") {
    await supabase.from("schedule_changes").insert({
      kind: "remove", staff_id: person, date, start_min: start, end_min: end, event_id: ev.id,
    });
  }
  refresh();
  redirect(`/events/${ev.id}`);
}

/** Step 3: apply one of the suggested fixes. Suggestions are recomputed here, never trusted from the browser. */
export async function applyPlan(fd: FormData) {
  const supabase = await requireAdmin();
  const eventId = Number(fd.get("eventId"));
  const index = Number(fd.get("index"));
  const description = String(fd.get("description") ?? "");
  const path = `/events/${eventId}`;

  const { data: ev } = await supabase.from("events").select("id, title, person, date, start_min, end_min").eq("id", eventId).maybeSingle();
  if (!ev) return redirect("/events");

  const ctx = await loadWeekContext(supabase, ev.date);
  const plans = suggestPlans({ date: ev.date, template: ctx.template, changes: ctx.changes, events: ctx.events, staff: ctx.staff });
  const plan = plans[index];
  if (!plan || plan.description !== description) return fail(path, "The schedule changed since you opened this. Please look at the suggestions again.");

  const { error } = await supabase.from("schedule_changes").insert(
    plan.additions.map((a) => ({ kind: "add", staff_id: a.staffId, date: ev.date, start_min: a.start, end_min: a.end, event_id: ev.id })),
  );
  if (error) return fail(path, error.message);
  refresh();
  revalidatePath(path);
  redirect(path);
}

/** Deleting an event also undoes every schedule change it caused. */
export async function deleteEvent(fd: FormData) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("events").delete().eq("id", Number(fd.get("eventId")));
  if (error) return fail("/events", error.message);
  refresh();
  redirect("/events");
}
