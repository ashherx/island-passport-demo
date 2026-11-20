/**
 * What the stamper (the hand tool) is made of in each art direction.
 *
 *   classic  midnight lacquer handle, brass ferrule and mount, oxblood rubber
 *   reef     coral enamel handle, sand-gold ferrule, sea-green mount, slate rubber
 *   journal  turned beech handle, copper ferrule, walnut mount, black rubber
 *
 * Foil colours come from the direction tokens, so the tool always matches the passport cover.
 */
import type { DirectionTokens } from "@/lib/directions";
import type { DirectionId } from "@/lib/types";

/** A surface shaded as a cylinder lit from the upper left. */
export interface Surface {
  /** Mid tone. */
  base: string;
  /** Broad highlight. */
  light: string;
  /** Core shadow. */
  dark: string;
  /** Deepest tone at the silhouette. */
  deep: string;
  /** Thin reflected light on the far edge. */
  rim: string;
  /** Strength of the tight specular streak, 0..1. */
  gloss: number;
}

export interface StamperMaterial {
  handle: Surface;
  /** Metal ring where the handle meets the mount, and the inlay bands on the handle. */
  metal: Surface;
  /** Wall of the mount. */
  mountSide: Surface;
  /** Top face of the mount. */
  mountTop: Surface;
  /** Width of the metal rim on the mount's top face, as a fraction of its half-width. */
  rimWidth: number;
  /** Bands turned into the handle: "inlay" draws them in metal, "groove" cuts them dark. */
  bands: "inlay" | "groove";
  /** Draw wood grain on the mount's top face and the handle. */
  grain: boolean;
  rubber: Surface;
  /** Lettering engraved on the mount's top face. */
  engrave: string;
  engraveHi: string;
}

const brass = (tok: DirectionTokens): Surface => ({
  base: tok.foil.base,
  light: tok.foil.hi,
  dark: tok.foil.lo,
  deep: tok.foil.shadow,
  rim: tok.foil.base,
  gloss: 0.85,
});

export function stamperMaterial(tok: DirectionTokens): StamperMaterial {
  const id: DirectionId = tok.id;
  if (id === "reef") {
    return {
      handle: { base: "#ee6a4c", light: "#ffb7a2", dark: "#b23a22", deep: "#7c2414", rim: "#ff9a80", gloss: 0.9 },
      metal: brass(tok),
      mountSide: { base: "#128079", light: "#58c9bd", dark: "#07494a", deep: "#042c2f", rim: "#2aa39a", gloss: 0.6 },
      mountTop: { base: "#0f6f6a", light: "#3fb3a8", dark: "#0a4e4c", deep: "#063a3a", rim: "#2aa39a", gloss: 0.5 },
      rimWidth: 0.075,
      bands: "inlay",
      grain: false,
      rubber: { base: "#31494b", light: "#587375", dark: "#1b2c2e", deep: "#101c1e", rim: "#3e5a5c", gloss: 0.15 },
      engrave: "rgba(3,34,36,.55)",
      engraveHi: "rgba(160,235,225,.30)",
    };
  }
  if (id === "journal") {
    return {
      handle: { base: "#c48a4c", light: "#e3b57a", dark: "#8d5a2c", deep: "#5c3817", rim: "#c9975c", gloss: 0.18 },
      metal: brass(tok),
      mountSide: { base: "#7a5532", light: "#b08656", dark: "#4a311a", deep: "#2c1c0e", rim: "#8f6a42", gloss: 0.2 },
      mountTop: { base: "#84603a", light: "#b99062", dark: "#5e4124", deep: "#432c16", rim: "#8f6a42", gloss: 0.15 },
      rimWidth: 0.03,
      bands: "groove",
      grain: true,
      rubber: { base: "#2a2724", light: "#55504a", dark: "#171513", deep: "#0c0b0a", rim: "#3a3632", gloss: 0.12 },
      engrave: "rgba(34,20,8,.6)",
      engraveHi: "rgba(240,205,160,.22)",
    };
  }
  return {
    handle: { base: "#1d2d5e", light: "#6f8bd6", dark: "#0b1433", deep: "#050a1c", rim: "#33498c", gloss: 1 },
    metal: brass(tok),
    mountSide: brass(tok),
    mountTop: { base: "#17264f", light: "#3b54a0", dark: "#0d1736", deep: "#080f26", rim: "#33498c", gloss: 0.7 },
    rimWidth: 0.085,
    bands: "inlay",
    grain: false,
    rubber: { base: "#6b2a26", light: "#a2524b", dark: "#3f1614", deep: "#260c0b", rim: "#7d3832", gloss: 0.15 },
    engrave: "rgba(4,8,22,.6)",
    engraveHi: "rgba(150,175,240,.28)",
  };
}
