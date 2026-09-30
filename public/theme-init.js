// Applies the saved theme before the first paint so neither the splash nor the app flashes
// the wrong colors (D-034). A separate file because the CSP blocks inline scripts (D-009).
// Keep the storage key and values in sync with `src/lib/theme.ts`.
(function () {
  var pref = "system";
  try {
    var saved = localStorage.getItem("sweepr.theme");
    if (saved === "light" || saved === "dark") pref = saved;
  } catch (e) {
    // Storage unavailable: follow the system.
  }
  var dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
})();
