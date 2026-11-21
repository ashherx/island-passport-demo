import { DEFAULT_OPTION, OPTION_QUERY, OPTION_STORAGE_KEY } from "./types";

/**
 * Runs while the page is parsed, before the landing paints: puts data-option on <html> from
 * `?option=`, else localStorage, else the default. Plain ES5 in try/catch because storage throws
 * in some in-app browsers. OptionProvider adopts whatever this leaves on <html>.
 */
/**
 * Stopgap. The root layout (src/app/layout.tsx, not owned by this module) still preloads the
 * passport's cover texture, about 300 KB at high priority, whenever the path is "/", which is
 * where the passport used to be. The globe landing never uses it. Removing the <link> while the
 * page is still being parsed cancels the request. Delete this once the layout checks for
 * "/passport" instead.
 */
const dropCoverPreload = `var p=document.head.querySelectorAll('link[rel="preload"][as="image"][href*="/textures/"]');for(var i=0;i<p.length;i++)p[i].parentNode.removeChild(p[i]);`;

export const optionBootScript = `(function(){try{var e=document.documentElement,o=null,m=/[?&]${OPTION_QUERY}=([abc])(?:&|$)/.exec(location.search);if(m)o=m[1];if(!o){try{o=localStorage.getItem("${OPTION_STORAGE_KEY}")}catch(x){}}if(o!=="a"&&o!=="b"&&o!=="c")o="${DEFAULT_OPTION}";e.setAttribute("data-option",o);${dropCoverPreload}}catch(x){}})();`;
