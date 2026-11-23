import { Demo } from "@/components/demo";
import { textureUrl } from "@/lib/assets";
import { DEFAULT_DIRECTION, DIRECTIONS, STORAGE_KEYS } from "@/lib/directions";

/**
 * /passport: the composed motion demo (interactive passport, the stamping moment, the status
 * upgrade and the Provincial Stamp award), exactly as it was on the home page before the globe
 * landing took over "/". The closed passport cover is rendered on the server; everything heavier
 * loads after first paint (see src/components/demo/Demo.tsx). Metadata comes from the root layout.
 */

/** Cover texture per direction: the largest paint on this screen, but only known to CSS. */
const COVER_TEXTURES = Object.fromEntries(Object.values(DIRECTIONS).map((d) => [d.id, textureUrl(d.cover.texture)]));

/**
 * The root layout preloads the cover texture only when the path is "/", which is where this page
 * used to live. Until that check is updated, this does the same job here: it runs while the body
 * is parsed, after the theme boot script has set data-direction, and before the cover paints.
 */
const coverPreloadScript = `(function(){try{var d=document.documentElement.getAttribute("data-direction"),t=${JSON.stringify(
  COVER_TEXTURES,
)},u=t[d]||t[${JSON.stringify(
  DEFAULT_DIRECTION,
)}];if(u&&!document.head.querySelector('link[rel="preload"][href="'+u+'"]')){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=u;l.setAttribute("fetchpriority","high");document.head.appendChild(l)}}catch(x){}})();`;

/**
 * The passport is shown on the light stage unless the visitor has chosen a mode themselves (the
 * theme boot script follows the system setting, which would put a dark-mode laptop on the dark
 * stage). Runs after that script and before first paint; the theme provider adopts the result.
 */
const lightDefaultScript = `(function(){try{var m=null;try{m=localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.mode,
)})}catch(x){}if(m!=="light"&&m!=="dark"){var e=document.documentElement;e.setAttribute("data-theme","light");e.style.colorScheme="light"}}catch(x){}})();`;

export default function PassportPage() {
  return (
    <>
      <script id="ip-passport-light" dangerouslySetInnerHTML={{ __html: lightDefaultScript }} />
      <script id="ip-passport-preload" dangerouslySetInnerHTML={{ __html: coverPreloadScript }} />
      <Demo />
    </>
  );
}
