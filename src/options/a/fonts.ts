/**
 * Option A typefaces: an elegant high-contrast serif for display (Instrument Serif) and a clean
 * geometric sans for everything else (DM Sans). Loaded here, not in the root layout, so only a
 * visitor looking at option A downloads them.
 */
import { DM_Sans, Instrument_Serif } from "next/font/google";

export const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--da-serif",
  display: "swap",
});

export const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--da-sans",
  display: "swap",
});

export const fontClass = `${serif.variable} ${sans.variable}`;
