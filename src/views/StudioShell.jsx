import { useMemo, useState } from "react";
import SuggestPanel from "../components/studio/SuggestPanel.jsx";
import ReceiptRail from "../components/studio/ReceiptRail.jsx";
import { SUGGESTIONS } from "../studio/suggest.js";

export default function StudioShell({ children }) {
  const [activeId, setActiveId] = useState(SUGGESTIONS[0].id);
  const [query, setQuery] = useState("");

  const active = useMemo(
    () => SUGGESTIONS.find((row) => row.id === activeId) || SUGGESTIONS[0],
    [activeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return SUGGESTIONS.find((row) =>
      row.prompt.toLowerCase().includes(q) || row.hint.toLowerCase().includes(q),
    );
  }, [query]);

  const receiptId = filtered?.receiptId || active.receiptId;

  return (
    <div className="studio">
      <SuggestPanel
        activeId={filtered?.id || activeId}
        onSelect={(row) => {
          setActiveId(row.id);
          setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
      />
      <div className="studio-center">
        {children}
      </div>
      <ReceiptRail receiptId={receiptId} />
    </div>
  );
}
