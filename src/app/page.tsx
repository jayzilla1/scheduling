import Link from "next/link";
import { Suspense } from "react";
import { Avatar, AppFrame, DayStrip, Pill, SectionTitle, ShiftCard } from "@/components/ui";
import { first, getSession, isDay } from "@/lib/schedule/queries";
import { gapsForDate } from "@/lib/schedule/rules";
import { AFTERNOON_STARTS_AT, fmtRange } from "@/lib/schedule/time";
import { DAY_LABELS, type Shift } from "@/lib/schedule/types";

async function Today({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  const s = await getSession();
  const now = s.now;

  const day = isDay(first(sp.day)) ? (first(sp.day) as keyof typeof DAY_LABELS) : (now.day ?? "mon");
  const onlyMe = first(sp.who) === "me" && !!s.myStaffId;
  const nameOf = (id: string) => s.staff.find((x) => x.id === id)?.name ?? id;

  const dayShifts = s.effective
    .filter((x) => x.day === day && (!onlyMe || x.staffId === s.myStaffId))
    .sort((a, b) => a.start - b.start);
  const morning = dayShifts.filter((x) => x.start < AFTERNOON_STARTS_AT);
  const afternoon = dayShifts.filter((x) => x.start >= AFTERNOON_STARTS_AT);

  const hereIds = [...new Set(s.effective.filter((x) => x.day === day).sort((a, b) => a.start - b.start).map((x) => x.staffId))];
  const isToday = day === now.day;
  const live = (x: Shift) => isToday && now.minutes >= x.start && now.minutes < x.end;

  const dayEvents = s.events.filter((e) => e.date === now.isoDates[day]);
  const gaps = s.isAdmin ? gapsForDate(now.isoDates[day], s.shifts, s.changes, s.events) : [];
  const afternoonStaff = new Set(s.effective.filter((x) => x.day === day && x.start >= AFTERNOON_STARTS_AT).map((x) => x.staffId)).size;

  const greeting = now.hour < 12 ? "Good morning" : now.hour < 17 ? "Good afternoon" : "Good evening";
  const myDays = s.myStaffId ? [...new Set(s.effective.filter((x) => x.staffId === s.myStaffId).map((x) => x.day))] : [];
  const href = (d: string) => `/?day=${d}${onlyMe ? "&who=me" : ""}`;

  return (
    <AppFrame isAdmin={s.isAdmin} name={s.displayName} active="today">
      <p className="text-sm text-muted">
        {isToday ? "Today" : DAY_LABELS[day]} · {now.monthLabel} {now.dates[day]}
      </p>
      <h1 className="mb-5 text-2xl font-semibold leading-tight">
        {greeting}, {s.displayName}
      </h1>

      <DayStrip selected={day} dates={now.dates} today={now.day} dotDays={myDays} hrefFor={href} />

      {/* Who's here */}
      <section className="mt-5 rounded-3xl border border-line bg-white p-5">
        <p className="text-sm text-muted">Who&apos;s here {isToday ? "today" : `on ${DAY_LABELS[day]}`}</p>
        {hereIds.length === 0 ? (
          <p className="mt-2 text-lg font-semibold">No one scheduled</p>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <div className="flex -space-x-2">
              {hereIds.map((id) => (
                <Avatar key={id} id={id} name={nameOf(id)} size={42} />
              ))}
            </div>
            <p className="text-right text-sm text-muted">
              {hereIds.map(nameOf).join(", ")}
            </p>
          </div>
        )}
      </section>

      {s.myStaffId && (
        <div className="mt-4 inline-flex rounded-full bg-white p-1 text-sm font-medium">
          <Link href={`/?day=${day}`} className={`rounded-full px-4 py-1.5 ${!onlyMe ? "bg-(--accent-soft)" : "text-muted"}`}>
            Everyone
          </Link>
          <Link href={`/?day=${day}&who=me`} className={`rounded-full px-4 py-1.5 ${onlyMe ? "bg-(--accent-soft)" : "text-muted"}`}>
            Only me
          </Link>
        </div>
      )}

      <SectionTitle>Morning</SectionTitle>
      {morning.length === 0 ? (
        <p className="rounded-3xl bg-white p-4 text-sm text-muted">No morning shifts.</p>
      ) : (
        <ul className="space-y-3">
          {morning.map((x, i) => (
            <ShiftCard key={i} shift={x} name={nameOf(x.staffId)} live={live(x)} />
          ))}
        </ul>
      )}

      <SectionTitle
        right={
          day === "fri" ? (
            <Pill tone="calm">Lighter day</Pill>
          ) : !onlyMe ? (
            <Pill tone={gaps.length === 0 && afternoonStaff >= 2 ? "ok" : "warn"}>
              {gaps.length === 0 && afternoonStaff >= 2 ? "2+ covered" : "Needs attention"}
            </Pill>
          ) : null
        }
      >
        Afternoon
      </SectionTitle>
      {afternoon.length === 0 ? (
        <p className="rounded-3xl bg-white p-4 text-sm text-muted">No afternoon shifts.</p>
      ) : (
        <ul className="space-y-3">
          {afternoon.map((x, i) => (
            <ShiftCard key={i} shift={x} name={nameOf(x.staffId)} live={live(x)} />
          ))}
        </ul>
      )}

      {s.isAdmin && !onlyMe && dayEvents.length > 0 && (
        <div className="mt-4 rounded-3xl bg-white p-4 text-sm">
          <p className="mb-1 font-semibold">On the calendar</p>
          {dayEvents.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="block text-muted underline-offset-4 hover:underline">
              {e.title} · {e.person === "pam" ? "Pam" : nameOf(e.person)} · {fmtRange(e.start, e.end)}
            </Link>
          ))}
        </div>
      )}

      {s.isAdmin && !onlyMe && gaps.length > 0 && (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Heads up</p>
          {gaps.map((g, i) => (
            <p key={i}>
              Only {g.have} {g.have === 1 ? "person" : "people"} from {fmtRange(g.start, g.end)}
            </p>
          ))}
          <Link href={dayEvents[0] ? `/events/${dayEvents[0].id}` : `/admin?day=${day}`} className="mt-2 inline-block font-semibold underline">
            {dayEvents[0] ? "See suggested fixes" : "Fix in editor"}
          </Link>
        </div>
      )}
    </AppFrame>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <Today searchParams={props.searchParams} />
    </Suspense>
  );
}
