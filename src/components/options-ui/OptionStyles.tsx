import { optionBootScript, optionsCss } from "@/lib/options";

/**
 * Server-rendered head matter for a page that shows a design option: the three palettes as CSS
 * variables, and the script that puts data-option on <html> before first paint. Render it once,
 * above <OptionProvider>.
 */
export function OptionStyles() {
  return (
    <>
      <style id="ip-options" dangerouslySetInnerHTML={{ __html: optionsCss() }} />
      <script id="ip-option-boot" dangerouslySetInnerHTML={{ __html: optionBootScript }} />
    </>
  );
}
