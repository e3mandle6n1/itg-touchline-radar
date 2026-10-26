import { useUi } from "../context/UiContext.jsx";

export default function ThemeSwitch() {
  const { theme, toggleTheme, t } = useUi();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-switch${dark ? " is-dark" : ""}`}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? t("themeDark") : t("themeLight")}
      title={dark ? t("themeDark") : t("themeLight")}
      onClick={toggleTheme}
    >
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-thumb" />
      </span>
    </button>
  );
}
