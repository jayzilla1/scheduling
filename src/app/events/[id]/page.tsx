import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppFrame, Pill, SectionTitle } from "@/components/ui";
import { prettyDate } from "@/lib/schedule/dates";
import { first, getSession, loadWeekContext, toEvent } from "@/lib/schedule/queries";
import { gapsForDate } from "@/lib/schedule/rules";
import { suggestPlans } from "@/lib/schedule/suggest";
import { fmtRange } from "@/lib/schedule/time";
import { createClient } from "@/lib/supabase/server";
import { applyPlan, deleteEvent } from "../actions";

async function Detail({ params, searchParams }: { params: PageProps<"/events/[id]">["params"]; searchParams: PageProps<"/events/[id]">["searchParams"] }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await getSession();
  if (!s.isAdmin) redirect("/");

  const supabase = await createClient();
  const { data: row } = await supabase.from("events").select("id, title, person, date, start_min, end_min").eq("id", Number(id)).maybeSingle();
  if (!row) notFound();
  const ev = toEvent(row);

  const ctx = await loadWeekContext(supabase, ev.date);
  const nameOf = (pid: string) => (pid === "pam" ? "Pam" : (ctx.staff.find((x) => x.id === pid)?.name ?? pid));
  const gaps = gapsForDate(ev.date, ctx.template, ctx.changes, ctx.events);
  const plans = gaps.length ? suggestPlans({ date: ev.date, template: ctx.template, changes: ctx.changes, events: ctx.events, staff: ctx.staff }) : [];
  const made = ctx.changes.filter((c) => c.eventId === ev.id);
  const error = first(sp.error);

  return (
    <AppFrame isAdmin name={s.displayName} active="events">
      <Link href="/events" className="mb-3 inline-block text-sm text-muted underline-offset-4 hover:underline">← All events</Link>
      <h1 className="text-2xl font-semibold leading-tight">{ev.title}</h1>
      <p className="mb-5 text-sm text-muted">
        {prettyDate(ev.date)} · {fmtRange(ev.start, ev.end)} · {nameOf(ev.person)} away
      </p>

      {error && <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}

      <section className="rounded-3xl bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Schedule check</h2>
          <Pill tone={gaps.length === 0 ? "ok" : "warn"}>{gaps.length === 0 ? "All covered" : "Needs cover"}</Pill>
        </div>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted">
            {ev.person === "pam"
              ? "There are always 2 staff while Pam is away. Nothing to change."
              : "The afternoon still has 2 staff. Nothing more to change."}
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-amber-900">
            {gaps.map((g, i) => (
              <li key={i}>
                Only {g.have} {g.have === 1 ? "person" : "people"} from {fmtRange(g.start, g.end)}
              </li>
            ))}
          </ul>
        )}
        {ev.person === "pam" && gaps.length > 0 && (
          <p className="mt-2 text-xs text-muted">While Pam is away, the girls need 2 people at all times, even on Fridays.</p>
        )}
      </section>

      {gaps.length > 0 && (
        <>
          <SectionTitle>Suggested fixes</SectionTitle>
          {plans.length === 0 ? (
            <p className="rounded-3xl bg-white p-4 text-sm text-muted">
              I couldn&apos;t find a fix that keeps everyone within their rules (days off, Gianna&apos;s school hours, and so on).
              You may need to ask someone outside the usual team, or change a shift by hand in Edit.
            </p>
          ) : (
            <ul className="space-y-3">
              {plans.map((p, i) => (
                <li key={i} className="rounded-3xl bg-white p-4">
                  <p className="text-xs font-medium text-muted">Option {i + 1}</p>
                  <p className="mt-0.5 font-semibold">{p.description}</p>
                  {p.remaining.length > 0 && (
                    <p className="mt-1 text-xs text-amber-800">Still short: {p.remaining.map((g) => fmtRange(g.start, g.end)).join(", ")}</p>
                  )}
                  <form action={applyPlan} className="mt-3">
                    <input type="hidden" name="eventId" value={ev.id} />
                    <input type="hidden" name="index" value={i} />
                    <input type="hidden" name="description" value={p.description} />
                    <button className="w-full rounded-xl bg-(--accent) py-2 text-sm font-semibold text-(--on-accent)">Apply this fix</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            I can&apos;t see anyone&apos;s outside commitments, so check with the person first. Applying only changes this one day.
          </p>
        </>
      )}

      {made.length > 0 && (
        <>
          <SectionTitle>Changes made for this event</SectionTitle>
          <ul className="space-y-2 rounded-3xl bg-white p-4 text-sm">
            {made.map((c, i) => (
              <li key={i}>
                {c.kind === "add" ? "Added" : "Off"}: <b>{nameOf(c.staffId)}</b> {fmtRange(c.start, c.end)}
              </li>
            ))}
          </ul>
        </>
      )}

      <form action={deleteEvent} className="mt-8">
        <input type="hidden" name="eventId" value={ev.id} />
        <button className="w-full rounded-xl bg-rose-50 py-2.5 text-sm font-medium text-rose-700">Delete event and undo its changes</button>
      </form>
    </AppFrame>
  );
}

export default function EventPage(props: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <Detail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
