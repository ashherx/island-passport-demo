/**
 * Passport book, StPageFlip engine. See docs/agents/flip-lib.md.
 *
 *   import PassportBook, { usePassportPage } from "@/components/passport/engine-lib";
 */
export { default } from "./PassportBook";
export {
  usePassportPage,
  type BookSide,
  type BookState,
  type PassportBookLibHandle,
  type PassportBookLibProps,
  type PassportPageInfo,
} from "./PassportBook";
export type { FlipMode } from "./flip-engine";
