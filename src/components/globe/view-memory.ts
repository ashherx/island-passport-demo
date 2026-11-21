/**
 * Remembers the camera of the last globe on the page, so a globe that mounts next (after an
 * option switch, which swaps the whole landing) starts exactly where the previous one stopped.
 * In memory only: a reload starts from the home view again.
 */
import type { CameraState, Padding } from "./camera";

export interface RememberedView extends CameraState {
  padding: Padding;
  /** Island the camera was at or heading for. */
  targetId: string | null;
  /** True when the camera was in the whole-globe view. */
  atHome: boolean;
}

let remembered: RememberedView | null = null;

export function rememberView(view: RememberedView): void {
  remembered = view;
}

export function recallView(): RememberedView | null {
  return remembered;
}

export function forgetView(): void {
  remembered = null;
}
