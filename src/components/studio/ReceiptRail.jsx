import { useUi } from "../../context/UiContext.jsx";
import { receiptFor } from "../../studio/receipts.js";
import ReceiptCard from "./ReceiptCard.jsx";

export default function ReceiptRail({ receiptId }) {
  const { t } = useUi();
  const receipt = receiptFor(receiptId);

  return (
    <aside className="studio-rail studio-rail-right" aria-label={t("answerTitle")}>
      <div className="studio-rail-head">
        <span className="studio-kicker">{t("answerKicker")}</span>
        <h2>{t("answerTitle")}</h2>
        <p className="studio-rail-lede">{t("answerLede")}</p>
      </div>
      <ReceiptCard receipt={receipt} />
    </aside>
  );
}
