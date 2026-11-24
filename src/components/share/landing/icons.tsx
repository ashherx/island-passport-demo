/**
 * Line icons the recipient page needs on top of the kit's set. Same drawing rules: generic,
 * currentColor, hidden from assistive tech.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function IconGlobe(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2M12 3.4c3 2.5 3 14.7 0 17.2M12 3.4c-3 2.5-3 14.7 0 17.2" />
    </Svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="3" />
      <path d="m4.4 7.6 7.6 5.6 7.6-5.6" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3 2" />
    </Svg>
  );
}

/** A rosette: the Verified Supporter seal. */
export function IconSeal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.2l2 1.5 2.5-.2.9 2.3 2.1 1.3-.6 2.4.9 2.3-1.9 1.6-.4 2.4-2.4.5-1.5 2-2.3-.9-2.3.9-1.5-2-2.4-.5-.4-2.4-1.9-1.6.9-2.3-.6-2.4 2.100-1.300.9-2.300 2.500.200z" />
      <path d="m8.9 12.200 2.200 2.200 4-4.300" />
    </Svg>
  );
}

/** Arrow leaving a box: "this opens somewhere else". */
export function IconExternal(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.500 4.500H19.500V10.500M19.200 4.800 11 13M18 14.200V17a2.500 2.500 0 0 1-2.500 2.500H7A2.500 2.500 0 0 1 4.500 17V8.500A2.500 2.500 0 0 1 7 6h2.800" />
    </Svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6.500 9.500 5.500 5.500 5.500-5.500" />
    </Svg>
  );
}

/** A compass: "open this in your own browser". */
export function IconCompass(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m15.300 8.700-1.700 4.900-4.900 1.700 1.700-4.900z" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6.500-5.600 6.500-10.700A6.500 6.500 0 0 0 5.500 10.300C5.500 15.400 12 21 12 21z" />
      <circle cx="12" cy="10.200" r="2.300" />
    </Svg>
  );
}

export function IconUserCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9.500" cy="8.200" r="3.500" />
      <path d="M3.500 19.500c.6-3.300 3-5 6-5s5.400 1.700 6 5M16 9.800l1.800 1.800 3.200-3.400" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.500" y="10.500" width="13" height="9" rx="2.500" />
      <path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500" />
    </Svg>
  );
}
