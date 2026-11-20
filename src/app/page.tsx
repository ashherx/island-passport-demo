import { Demo } from "@/components/demo";

/**
 * Home: the composed motion demo (interactive passport, the stamping moment, the status upgrade
 * and the Provincial Stamp award). The closed passport cover is rendered on the server; everything
 * heavier loads after first paint (see src/components/demo/Demo.tsx).
 */
export default function Home() {
  return <Demo />;
}
