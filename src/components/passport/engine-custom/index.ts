/**
 * Custom passport engine. Default export implements PassportBookProps and PassportBookHandle
 * from "@/lib/types". Load it lazily (UX-7):
 *
 *   const PassportBook = dynamic(() => import("@/components/passport/engine-custom"), { ssr: false });
 */
export { default } from "./PassportBook";
export type { CustomPassportBookHandle, CustomPassportBookProps } from "./PassportBook";
export { PAGE_W, PAGE_H } from "./layout";
