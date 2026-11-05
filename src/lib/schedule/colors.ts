export interface PersonColor {
  bg: string; // card background
  fg: string; // text on the card
  dot: string; // avatar / accent
}

const PALETTE: PersonColor[] = [
  { bg: "#DDF4F1", fg: "#0B5F58", dot: "#14B8A6" }, // teal
  { bg: "#E9E4FD", fg: "#4B2BB5", dot: "#8B5CF6" }, // lavender
  { bg: "#FFE9D9", fg: "#9A3F0B", dot: "#FB923C" }, // peach
  { bg: "#FFE1EA", fg: "#A11D47", dot: "#F472B6" }, // rose
  { bg: "#E2EEFF", fg: "#1C4FA0", dot: "#60A5FA" }, // sky
];

const FIXED: Record<string, number> = { naimah: 0, mack: 1, gianna: 2 };

export function colorFor(staffId: string): PersonColor {
  if (staffId in FIXED) return PALETTE[FIXED[staffId]];
  let h = 0;
  for (const c of staffId) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length;
  return PALETTE[h];
}
