import { useEffect, useId, useRef, useState } from "react";
import { useUi } from "../context/UiContext.jsx";
import { LOCALES, localeFor } from "../i18n/locales.js";

export default function LangPicker() {
  const { lang, setLang, t } = useUi();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef(null);
  const current = localeFor(lang);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="lang-flag-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("language")}
        title={current.name}
        onClick={() => setOpen(true)}
      >
        <span className="lang-flag" aria-hidden="true">{current.flag}</span>
      </button>

      {open ? (
        <div
          className="lang-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="lang-modal-panel">
            <button
              ref={closeRef}
              type="button"
              className="lang-modal-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="lang-modal-hero" aria-hidden="true">
              <div className="lang-modal-map" />
            </div>
            <h2 id={titleId} className="lang-modal-title">{t("chooseLanguage")}</h2>
            <ul className="lang-modal-grid">
              {LOCALES.map((row) => {
                const on = row.id === lang;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`lang-modal-option${on ? " is-on" : ""}`}
                      onClick={() => {
                        setLang(row.id);
                        setOpen(false);
                      }}
                    >
                      <span className="lang-flag" aria-hidden="true">{row.flag}</span>
                      <span>{row.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
