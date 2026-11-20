/**
 * This copy now lives in src/lib/strings.ts as `strings.flipCustomLab` (TEC-12: one strings file).
 * Moved there by the integrator; this module only re-exports it so existing imports keep working.
 */
import { strings } from "@/lib/strings";

export const flipLabStrings = strings.flipCustomLab;
