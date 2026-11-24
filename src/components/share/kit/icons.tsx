/**
 * Small line icons for the share kit. Drawn here, generic on purpose: none of them copies a
 * platform's icon. All inherit `currentColor` and are hidden from assistive tech.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The Island Passport mark used across option A: a small dotted globe. */
export function BrandMark({ size = 26, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
      <circle cx="16" cy="16" r="14.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.6 2.3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="9.4" fill="currentColor" opacity="0.14" />
      <circle cx="16" cy="16" r="9.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.6 16h18.8M16 6.6c3.4 2.7 3.4 16.1 0 18.8M16 6.6c-3.4 2.7-3.4 16.1 0 18.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.6" />
    <path d="M15.5 5.6A2.4 2.4 0 0 0 13.4 4.5H7.1A2.6 2.6 0 0 0 4.5 7.1v6.3a2.4 2.4 0 0 0 1.1 2.1" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.6l4.4 4.4L19 7.4" />
  </Svg>
);
export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconShare = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15V4m0 0L8 8m4-4l4 4" />
    <path d="M6 12.5v5A2.5 2.5 0 0 0 8.5 20h7a2.5 2.5 0 0 0 2.5-2.5v-5" />
  </Svg>
);
export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4" />
    <path d="M5 19.5h14" />
  </Svg>
);
export const IconCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 8L4.5 12l4 4M15.5 8l4 4-4 4M13.3 6l-2.6 12" />
  </Svg>
);
export const IconText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7h14M5 12h14M5 17h8" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6.5l11 11m0-11l-11 11" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);
export const IconArrow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14m0 0l-5.5-5.5M19 12l-5.5 5.5" />
  </Svg>
);
export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconPlay = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M8.2 5.3a1 1 0 0 1 1.5-.9l10 6.7a1 1 0 0 1 0 1.7l-10 6.7a1 1 0 0 1-1.5-.9z" />
  </Svg>
);
export const IconPause = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="4" height="14" rx="1.3" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.3" />
  </Svg>
);
export const IconReplay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12a7 7 0 1 0 2.3-5.2" />
    <path d="M5 5v4.2h4.2" />
  </Svg>
);
/* Abstract placeholders for a post's actions: like, comment, pass on, keep. */
export const IconHeart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19.5s-7-4.3-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.2c0 5-7 9.3-7 9.3z" />
  </Svg>
);
export const IconBubble = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5a7.5 7.5 0 0 0-6.4 11.4L4.5 19.5l3.7-1.1A7.5 7.5 0 1 0 12 4.5z" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.5 5.5l6 5.5-6 5.5v-3.4c-4.6 0-7.4 1.3-9 4.4.3-5.2 3.2-8.3 9-8.7z" />
  </Svg>
);
export const IconKeep = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.6l2.3 4.7 5.2.7-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.7z" />
  </Svg>
);
export const IconDots = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <circle cx="6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18" cy="12" r="1.5" />
  </Svg>
);
