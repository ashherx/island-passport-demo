/**
 * Minimal typings for "page-flip" (StPageFlip 2.0.7), which ships without declarations.
 * Only the public surface is declared here. The private members that flip-engine.ts reaches
 * into are typed locally in that file, next to the code that depends on them.
 */
declare module "page-flip" {
  export interface Point {
    x: number;
    y: number;
  }

  export interface PageRect {
    left: number;
    top: number;
    /** Width of the whole book (two pages), also in portrait mode. */
    width: number;
    height: number;
    pageWidth: number;
  }

  export type FlippingState = "user_fold" | "fold_corner" | "flipping" | "read";
  export type FlipCorner = "top" | "bottom";
  export type Orientation = "portrait" | "landscape";

  export interface FlipSetting {
    startPage: number;
    size: "fixed" | "stretch";
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    startZIndex: number;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    swipeDistance: number;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
  }

  export interface WidgetEvent {
    data: unknown;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, setting: Partial<FlipSetting>);
    destroy(): void;
    update(): void;
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    updateFromHtml(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    clear(): void;
    turnToPrevPage(): void;
    turnToNextPage(): void;
    turnToPage(page: number): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(page: number, corner?: FlipCorner): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): Orientation;
    getBoundsRect(): PageRect;
    getSettings(): FlipSetting;
    getState(): FlippingState;
    getRender(): unknown;
    getFlipController(): unknown;
    getPageCollection(): unknown;
    getUI(): unknown;
    on(eventName: string, callback: (e: WidgetEvent) => void): this;
    off(eventName: string): void;
  }
}
