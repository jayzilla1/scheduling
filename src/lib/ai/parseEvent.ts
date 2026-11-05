import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { isIsoDate } from "@/lib/schedule/dates";
import type { Staff } from "@/lib/schedule/types";

const Parsed = z.object({
  title: z.string(),
  person: z.string(),
  date: z.string(),
  start: z.string(),
  end: z.string(),
  assumptions: z.string(),
});

export interface DraftEvent {
  title: string;
  person: string;
  date: string;
  start: string;
  end: string;
  assumptions: string;
}

export class AiUnavailable extends Error {}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Turns a sentence like "Mia has a game Thursday at 4, I need to leave at 2:30"
 * into a structured event. The AI only reads the text; it never edits the schedule.
 */
export async function parseEventText(text: string, staff: Staff[], todayIso: string, weekday: string): Promise<DraftEvent> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailable("The AI assistant isn't set up yet.");

  const people = staff.map((s) => `${s.id} (${s.name})`).join(", ");
  const system = `You turn a daycare owner's short message into exactly one calendar event.

Today is ${weekday}, ${todayIso}.
People: "pam" (the owner, who is writing the message) and staff: ${people}.

Rules:
- "person" is whoever will be unavailable. Use "pam" when the owner herself has to leave or be away (including for her daughter's games and her own appointments). Use a staff id only when that staff member is the one who is away.
- "date" is YYYY-MM-DD. Resolve words like "Thursday" or "tomorrow" to the next upcoming such date, counting today.
- "start" and "end" are 24-hour HH:MM for the whole time the person is unavailable. If the owner says when she needs to leave and when she'll be back, use those, not the event's own start time.
- If no end time is given, assume 2 hours after the start.
- "title" is short and plain, like "Basketball game". Do not invent names.
- "assumptions": one short sentence describing anything you had to guess, or an empty string if nothing was guessed.`;

  const client = new Anthropic();
  const res = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: text.slice(0, 600) }],
    output_config: { effort: "low", format: zodOutputFormat(Parsed) },
  });

  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Couldn't read that message.");
  const p = res.parsed_output;
  if (!isIsoDate(p.date) || !HHMM.test(p.start) || !HHMM.test(p.end) || p.end <= p.start) {
    throw new Error("I couldn't work out the date or times from that. Try adding them, or use the form below.");
  }
  const person = p.person === "pam" || staff.some((s) => s.id === p.person) ? p.person : "pam";
  return { ...p, person };
}
