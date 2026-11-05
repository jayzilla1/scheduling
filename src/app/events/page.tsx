import Link from "next/link";
import { Suspense } from "react";
import { AppFrame, Pill, SectionTitle, SparkIcon } from "@/components/ui";
import { prettyDate } from "@/lib/schedule/dates";
import { first, getSession, toChange, toEvent } from "@/lib/schedule/queries";
import { gapsForDate } from "@/lib/schedule/rules";
import { fmtRange } from "@/lib/schedule/time";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { draftFromText, saveEvent } from "./actions";

const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-(--accent)";

async function EventsContent({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const sp = await searchParams;
  const s = await getSession();
  if (!s.isAdmin) redirect("/");

  const supabase = await createClient();
  const [{ data: eventRows }, { data: changeRows }] = await Promise.all([
    supabase.from("events").select("id, title, person, date, start_min, end_min").gte("date", s.now.todayIso).order("date").order("start_min"),
    supabase.from("schedule_changes").select("id, kind, staff_id, date, start_min, end_min, event_id").gte("date", s.now.todayIso),
  ]);
  const events = (eventRows ?? []).map(toEvent);
  const changes = (changeRows ?? []).map(toChange);
  const nameOf = (id: string) => (id === "pam" ? "Pam" : (s.staff.find((x) => x.id === id)?.name ?? id));

  const v = (k: string) => first(sp[k]) ?? "";
  const error = v("error");
  const fromAi = v("ai") === "1";

  return (
    <AppFrame isAdmin name={s.displayName} active="events">
      <h1 className="mb-1 text-2xl font-semibold">Events</h1>
      <p className="mb-5 text-sm text-muted">Games, appointments, emergencies. Tell me what&apos;s happening and I&apos;ll check the schedule.</p>

      {error && <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      {/* AI box */}
      <section className="rounded-3xl border border-line bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-(--accent)">
          <SparkIcon />
          <p className="font-semibold text-ink">Ask the assistant</p>
        </div>
        <form action={draftFromText} className="space-y-3">
          <textarea
            name="text"
            required
            rows={3}
            maxLength={600}
            placeholder={`e.g. "Her game is Thursday at 4. I need to leave at 2:30."`}
            className="w-full resize-none rounded-2xl border border-line bg-(--page) p-3 text-sm outline-none placeholder:text-muted focus:border-(--accent)"
          />
          <button className="w-full rounded-xl bg-(--accent) py-2.5 text-sm font-semibold text-(--on-accent)">Fill in the details for me</button>
        </form>
      </section>

      {/* Details form (prefilled by the assistant, or typed by hand) */}
      <SectionTitle>{fromAi ? "Here's what I understood" : "Or enter it yourself"}</SectionTitle>
      {fromAi && (
        <p className="mb-3 rounded-2xl bg-(--accent-soft) p-3 text-sm">
          Check the details, change anything that&apos;s off, then tap <b>Check the schedule</b>. Nothing is saved until you do.
          {v("note") && <span className="mt-1 block text-muted">Note: {v("note")}</span>}
        </p>
      )}
      <form action={saveEvent} className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4">
        <input name="title" defaultValue={v("title")} placeholder="What is it? (e.g. Basketball game)" required className={`${field} col-span-2`} />
        <label className="col-span-2 text-xs text-muted">
          Who is away?
          <select name="person" defaultValue={v("person") || "pam"} className={`${field} mt-1`}>
            <option value="pam">Pam</option>
            {s.staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-xs text-muted">
          Date
          <input type="date" name="date" defaultValue={v("date") || s.now.todayIso} required className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Away from
          <input type="time" name="start" defaultValue={v("start")} required className={`${field} mt-1`} />
        </label>
        <label className="text-xs text-muted">
          Back at
          <input type="time" name="end" defaultValue={v("end")} required className={`${field} mt-1`} />
        </label>
        <button className="col-span-2 mt-1 rounded-xl bg-(--accent) py-2.5 text-sm font-semibold text-(--on-accent)">Check the schedule</button>
      </form>

      <SectionTitle>Coming up</SectionTitle>
      {events.length === 0 ? (
        <p className="rounded-3xl bg-white p-4 text-sm text-muted">Nothing on the calendar yet.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const gaps = gapsForDate(e.date, s.shifts, changes, events);
            return (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="text-sm text-muted">
                      {prettyDate(e.date)} · {fmtRange(e.start, e.end)} · {nameOf(e.person)}
                    </p>
                  </div>
                  <Pill tone={gaps.length === 0 ? "ok" : "warn"}>{gaps.length === 0 ? "Covered" : "Needs cover"}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppFrame>
  );
}

export default function EventsPage(props: PageProps<"/events">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <EventsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
