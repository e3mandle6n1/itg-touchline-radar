import { useUi } from "../../context/UiContext.jsx";

export default function ReceiptCard({ receipt }) {
  const { t } = useUi();
  if (!receipt) return null;

  const chart = receipt.chart;
  const maxBar = chart
    ? Math.max(1, ...chart.bars.flatMap((bar) => [bar.a || 0, bar.b || 0]))
    : 1;

  return (
    <article className="receipt-card">
      <header className="receipt-card-head">
        <p className="receipt-question">{receipt.question}</p>
        <div className="receipt-badges">
          <span className="receipt-badge is-live">
            <i /> AI narrative: {receipt.status}
          </span>
          <span className="receipt-badge is-grounded">
            Grounded: {receipt.grounded} numbers checked
          </span>
          <span className="receipt-badge is-meta">
            {receipt.model} · {receipt.latency}
          </span>
        </div>
      </header>

      <p className="receipt-narrative">{receipt.narrative}</p>

      <div className="receipt-figures">
        {receipt.figures.map((fig) => (
          <div className="receipt-figure" key={fig.evidence}>
            <strong>{fig.value}</strong>
            <span>{fig.label}</span>
            <code>{fig.evidence}</code>
          </div>
        ))}
      </div>

      {chart ? (
        <div className="receipt-chart">
          <div className="receipt-chart-title">{chart.title}</div>
          <div className="receipt-chart-legend">
            <span><i className="a" /> {chart.bars[0]?.aLabel || "A"}</span>
            {chart.bars[0]?.bLabel ? (
              <span><i className="b" /> {chart.bars[0].bLabel}</span>
            ) : null}
          </div>
          <ul className="receipt-chart-bars">
            {chart.bars.map((bar) => (
              <li key={bar.name}>
                <span className="receipt-chart-name">{bar.name}</span>
                <div className="receipt-chart-track">
                  <em className="a" style={{ width: `${(bar.a / maxBar) * 100}%` }} title={String(bar.a)} />
                  {bar.bLabel ? (
                    <em className="b" style={{ width: `${(bar.b / maxBar) * 100}%` }} title={String(bar.b)} />
                  ) : null}
                </div>
                <span className="receipt-chart-vals">
                  {bar.a}{bar.bLabel ? ` / ${bar.b}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {receipt.caveats?.length ? (
        <footer className="receipt-caveats">
          <strong>{t("caveatsTitle")}</strong>
          <ul>
            {receipt.caveats.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
