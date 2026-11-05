import type { Shift, Staff } from "./types";
import { t } from "./time";

export const STAFF: Staff[] = [
  { id: "naimah", name: "Naimah" },
  { id: "mack", name: "Mack" },
  { id: "gianna", name: "Gianna" },
];

const s = (
  staffId: string,
  day: Shift["day"],
  start: string,
  end: string,
): Shift => ({ staffId, day, start: t(start), end: t(end) });

/**
 * Weekly template as described by Pam.
 * Gianna works afternoons only (3:00-5:30): Mon, Wed, and a third day that
 * defaults to Thursday (swap to Tuesday on slower weeks).
 */
export function buildTemplate(giannaThirdDay: "tue" | "thu" = "thu"): Shift[] {
  return [
    // Mack
    s("mack", "mon", "08:00", "12:30"),
    s("mack", "tue", "07:30", "11:30"),
    s("mack", "wed", "07:30", "11:00"),
    s("mack", "wed", "14:15", "17:15"),
    s("mack", "thu", "14:30", "17:30"),
    s("mack", "fri", "08:30", "11:30"),
    s("mack", "fri", "14:30", "17:30"),
    // Naimah
    s("naimah", "mon", "14:30", "16:30"),
    s("naimah", "tue", "08:30", "11:30"),
    s("naimah", "tue", "14:30", "16:30"),
    s("naimah", "wed", "08:30", "12:30"),
    s("naimah", "thu", "08:00", "12:30"),
    s("naimah", "fri", "08:00", "11:30"),
    // Gianna (afternoons only, school in the morning)
    s("gianna", "mon", "15:00", "17:30"),
    s("gianna", "wed", "15:00", "17:30"),
    s("gianna", giannaThirdDay, "15:00", "17:30"),
  ];
}
