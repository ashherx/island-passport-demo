/**
 * Fuzzy island search (UX-1a). Pure functions, no React: see useIslandSearch.ts for the hook.
 *
 * Matches the island name, its aliases, the country and the region. Forgiving on purpose: case
 * and accents are ignored, a word may start anywhere ("hills" finds Bohol through "Chocolate
 * Hills"), letters may be skipped ("bhl") and one or two typos are tolerated ("pangloa").
 */
import type { GlobeIsland } from "./types";

export type SearchField = "name" | "alias" | "country" | "region";

export interface IslandSearchResult {
  island: GlobeIsland;
  /** Higher is better. Only meaningful relative to other results of the same query. */
  score: number;
  /** Which field matched, and its text (e.g. the alias "Alona Beach"). */
  field: SearchField;
  matchedText: string;
  /** [start, end) ranges in `island.name` to highlight. Empty when another field matched. */
  ranges: [number, number][];
}

/** Lower-case, strip accents and punctuation. Keeps the length so highlight ranges line up. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ");
}

/** Damerau-Levenshtein distance, cut off above `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = row;
  }
  return prev[b.length];
}

interface FieldMatch {
  score: number;
  ranges: [number, number][];
}

/** Score `query` (already normalised, non-empty) against one piece of text. Null: no match. */
function matchText(query: string, text: string): FieldMatch | null {
  const hay = normalise(text);
  if (!hay.trim()) return null;

  // 1. Whole text starts with the query.
  if (hay.startsWith(query)) {
    return { score: 100 - Math.min(20, hay.length - query.length) * 0.5, ranges: [[0, query.length]] };
  }
  // 2. A word starts with the query.
  const wordStart = hay.indexOf(" " + query);
  if (wordStart >= 0) return { score: 82, ranges: [[wordStart + 1, wordStart + 1 + query.length]] };
  // 3. Query appears inside a word.
  const inside = hay.indexOf(query);
  if (inside >= 0 && query.length >= 2) return { score: 68, ranges: [[inside, inside + query.length]] };

  // 4. Typos: compare the query with each word, and with the start of each word.
  if (query.length >= 4) {
    const allowed = query.length >= 7 ? 2 : 1;
    let offset = 0;
    for (const word of hay.split(" ")) {
      if (word.length >= 3) {
        const whole = editDistance(query, word, allowed);
        const prefix = word.length > query.length ? editDistance(query, word.slice(0, query.length), allowed) : whole;
        const d = Math.min(whole, prefix);
        if (d <= allowed) {
          const end = whole <= prefix ? word.length : query.length;
          return { score: 56 - d * 8, ranges: [[offset, offset + end]] };
        }
      }
      offset += word.length + 1;
    }
  }

  // 5. Letters in order, with gaps ("bhl" finds Bohol). First letter must start a word.
  if (query.length >= 2 && !query.includes(" ")) {
    const ranges: [number, number][] = [];
    let at = -1;
    let gaps = 0;
    for (let i = 0; i < query.length; i++) {
      const next = hay.indexOf(query[i], at + 1);
      if (next < 0) return null;
      if (i === 0 && next > 0 && hay[next - 1] !== " ") return null;
      if (i > 0 && next !== at + 1) gaps += next - at - 1;
      const last = ranges[ranges.length - 1];
      if (last && last[1] === next) last[1] = next + 1;
      else ranges.push([next, next + 1]);
      at = next;
    }
    if (gaps <= Math.max(3, query.length)) return { score: 40 - gaps * 3, ranges };
  }
  return null;
}

const FIELD_WEIGHT: Record<SearchField, number> = { name: 1, alias: 0.9, region: 0.72, country: 0.66 };

export interface SearchOptions {
  /** Most results to return. Default 8. */
  limit?: number;
}

/**
 * Islands matching `query`, best first. Live islands win ties with "coming soon" ones.
 * An empty query returns every island in its given order (live first in the sample data), so the
 * list doubles as a browsable index.
 */
export function searchIslands(islands: readonly GlobeIsland[], query: string, options: SearchOptions = {}): IslandSearchResult[] {
  const limit = options.limit ?? 8;
  const q = normalise(query).replace(/\s+/g, " ").trim();
  if (!q) {
    return islands.slice(0, limit).map((island) => ({ island, score: 0, field: "name", matchedText: island.name, ranges: [] }));
  }

  const results: IslandSearchResult[] = [];
  for (const island of islands) {
    const candidates: [SearchField, string][] = [
      ["name", island.name],
      ...island.aliases.map((a): [SearchField, string] => ["alias", a]),
      ["region", island.region],
      ["country", island.country],
    ];
    let best: IslandSearchResult | null = null;
    for (const [field, text] of candidates) {
      const m = matchText(q, text);
      if (!m) continue;
      const score = m.score * FIELD_WEIGHT[field] + (island.status === "live" ? 2 : 0) + (island.rank === 1 ? 0.5 : 0);
      if (!best || score > best.score) {
        best = { island, score, field, matchedText: text, ranges: field === "name" ? m.ranges : [] };
      }
    }
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Split a name into plain and highlighted parts for rendering. */
export function highlightParts(text: string, ranges: [number, number][]): { text: string; hit: boolean }[] {
  if (!ranges.length) return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push({ text: text.slice(at, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}
