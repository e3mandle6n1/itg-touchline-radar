import { useUi } from "../../context/UiContext.jsx";
import { SUGGESTIONS } from "../../studio/suggest.js";

export default function SuggestPanel({ activeId, onSelect, query, onQueryChange }) {
  const { t } = useUi();

  return (
    <aside className="studio-rail studio-rail-left" aria-label={t("askTitle")}>
      <div className="studio-rail-head">
        <span className="studio-kicker">{t("askKicker")}</span>
        <h2>{t("askTitle")}</h2>
        <p className="studio-rail-lede">{t("askLede")}</p>
      </div>

      <label className="studio-search">
        <span className="studio-search-label">{t("search")}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
        />
      </label>

      <ul className="studio-suggest-list">
        {SUGGESTIONS.map((row) => {
          const on = row.id === activeId;
          return (
            <li key={row.id}>
              <button
                type="button"
                className={`studio-suggest${on ? " is-on" : ""}`}
                onClick={() => onSelect(row)}
              >
                <span className="studio-suggest-prompt">{row.prompt}</span>
                <span className="studio-suggest-hint">{row.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
