import { useEffect, useMemo, useRef, useState } from "react";
import { useUi } from "../context/UiContext.jsx";
import HeadToHead from "./HeadToHead.jsx";
import LineupsPanel from "./LineupsPanel.jsx";
import StandingsTable from "./StandingsTable.jsx";
import StatBars from "./StatBars.jsx";
import { iconFor, liveTimelineRows, statsAt } from "../match";

const TAB_IDS = [
  ["timeline", "tabTimeline", "tab-timeline"],
  ["statistics", "tabStatistics", "tab-statistics"],
  ["head", "tabHead", "tab-h2h"],
  ["standings", "tabStandings", "tab-standings"],
  ["lineups", "tabLineups", "tab-lineups"],
];

export function nextTabClick(tab, sheetOpen, id) {
  if (id === tab && sheetOpen) return { tab, sheetOpen: false };
  return { tab: id, sheetOpen: true };
}

function Statistics({ match, playTrack, playIndex }) {
  const { t } = useUi();
  const [page, setPage] = useState(0);
  const live = useMemo(
    () => statsAt(playTrack, playIndex, match.stats),
    [playTrack, playIndex, match.stats],
  );
  const rows = live.pages[page] || live.pages[0] || [];
  const showCards = page === 0 && rows.some((row) => row.label === "Cards");

  return (
    <>
      <div className="pager">
        <span>{t("statistics")}</span>
        <span className="pager-controls">
          <button type="button" aria-label="Previous page" onClick={() => setPage((p) => (p + live.pages.length - 1) % live.pages.length)}>
            <img src="/icons/chevron-left.svg" alt="" />
          </button>
          {page + 1}/{live.pages.length}
          <button type="button" aria-label="Next page" onClick={() => setPage((p) => (p + 1) % live.pages.length)}>
            <img src="/icons/chevron-right.svg" alt="" />
          </button>
        </span>
      </div>
      {showCards && (
        <div className="cards-row">
          <span>
            <img className="card-ico" src="/icons/stats-yellow-card.svg" alt="" />
            {match.home.short} {live.yellow.home}
            <img className="card-ico" src="/icons/stats-red-card.svg" alt="" />
            {live.red.home}
          </span>
          <span>
            <img className="card-ico" src="/icons/stats-yellow-card.svg" alt="" />
            {match.away.short} {live.yellow.away}
            <img className="card-ico" src="/icons/stats-red-card.svg" alt="" />
            {live.red.away}
          </span>
        </div>
      )}
      <StatBars rows={rows.filter((row) => row.label !== "Cards" || page !== 0)} />
    </>
  );
}

function TimelineList({ timeline, index, onSeek, sheetRef }) {
  const { t } = useUi();
  const rows = useMemo(() => liveTimelineRows(timeline, index), [timeline, index]);

  useEffect(() => {
    const sheet = sheetRef?.current;
    if (sheet) sheet.scrollTop = 0;
  }, [index, sheetRef]);

  return (
    <div className="tl-live">
      <div className="tl-heading">{t("timeline")}</div>
      <ol className="tl">
        {rows.map((event) => {
          const i = event.markIndex;
          return (
            <li key={`${event.playIndex ?? event.order}-${i}`}>
              <button
                type="button"
                className={i === index ? "on" : ""}
                onClick={() => onSeek(i)}
              >
                <img className="tl-ico" src={`/icons/${iconFor(event)}.svg`} alt="" />
                <time>{event.clock}</time>
                <span>{event.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function MatchTabs({ match, timeline, index, onSeek, playTrack, playIndex, preview }) {
  const { t } = useUi();
  const [tab, setTab] = useState("timeline");
  const [sheetOpen, setSheetOpen] = useState(true);
  const sheetRef = useRef(null);

  const selectTab = (id) => {
    const next = nextTabClick(tab, sheetOpen, id);
    setTab(next.tab);
    setSheetOpen(next.sheetOpen);
  };

  return (
    <>
      <div className="tabs" role="tablist">
        {TAB_IDS.map(([id, labelKey, icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sheetOpen && tab === id}
            aria-expanded={sheetOpen && tab === id}
            className={tab === id && sheetOpen ? "on" : tab === id ? "is-current" : ""}
            onClick={() => selectTab(id)}
          >
            <img src={`/icons/${icon}.svg`} alt="" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>
      {sheetOpen ? (
        <div
          ref={sheetRef}
          className={`sheet${tab === "lineups" ? " sheet-lineups" : ""}${tab === "timeline" ? " sheet-timeline" : ""}`}
        >
          {tab === "statistics" && (
            <Statistics match={match} playTrack={playTrack} playIndex={playIndex} />
          )}
          {tab === "head" && <HeadToHead match={match} />}
          {tab === "standings" && <StandingsTable rows={match.standings} />}
          {tab === "timeline" && (preview ? (
            <div className="tl-live">
              <div className="tl-heading">{t("timeline")}</div>
              <p className="tl-wait">Waiting for kickoff.</p>
            </div>
          ) : (
            <TimelineList
              timeline={timeline}
              index={index}
              onSeek={onSeek}
              sheetRef={sheetRef}
            />
          ))}
          {tab === "lineups" && <LineupsPanel match={match} />}
        </div>
      ) : null}
    </>
  );
}
