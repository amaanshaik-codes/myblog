// Theme toggle logic - moved to external file for better caching
(function () {
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;
  var icon = btn.querySelector(".theme-icon");

  var sun = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M20 12h2"></path><path d="M2 12H4"></path><path d="M17.66 6.34l1.42-1.42"></path><path d="M4.92 19.07l1.41-1.41"></path><path d="M17.66 17.66l1.42 1.42"></path><path d="M4.92 4.93l1.41 1.41"></path></svg>';
  var moon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>';

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function setTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    if (icon) icon.innerHTML = next === "dark" ? moon : sun;
    btn.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  setTheme(currentTheme());
  btn.addEventListener("click", function () {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
})();
