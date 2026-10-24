// Runs before first paint so a saved light/dark choice never flashes.
// No saved choice = follow the OS (prefers-color-scheme in globals.css).
const script = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
