const STORAGE_KEY = "myarah.map.theme";

function readPreference() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function storePreference(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Theme still applies for this session.
  }
}

export function createThemeController(toggle, onChange) {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = readPreference();
  let currentTheme = null;

  function apply() {
    const next = preference ?? (systemTheme.matches ? "dark" : "light");
    if (next === currentTheme) return;

    currentTheme = next;
    document.documentElement.dataset.theme = next;
    const action = next === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Switch to ${action} map`);
    toggle.setAttribute("aria-pressed", String(next === "dark"));
    toggle.title = `Switch to ${action} map`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      next === "dark" ? "#14282C" : "#F3F0E8"
    );
    onChange(next);
  }

  toggle.addEventListener("click", () => {
    preference = currentTheme === "dark" ? "light" : "dark";
    storePreference(preference);
    apply();
  });

  systemTheme.addEventListener("change", () => {
    if (preference === null) apply();
  });

  apply();
  return { getTheme: () => currentTheme };
}
