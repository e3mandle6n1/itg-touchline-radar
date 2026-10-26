import { useUi } from "../context/UiContext.jsx";

export default function Transport({
  clock,
  index,
  max,
  playing,
  onToggle,
  onSeek,
  bridge,
}) {
  const { t } = useUi();

  return (
    <footer className="transport">
      <button type="button" onClick={onToggle}>{playing ? t("pause") : t("play")}</button>
      {bridge ? (
        <button
          type="button"
          className="transport-feed"
          onClick={bridge.running ? bridge.pause : bridge.resume}
          disabled={bridge.done}
        >
          {bridge.done ? t("feedDone") : bridge.running ? t("holdFeed") : t("resumeFeed")}
        </button>
      ) : null}
      <span className="clock">{clock}</span>
      {bridge ? (
        <span className="feed-meter" aria-label="Bridge buffer">
          {bridge.received}/{bridge.total}
        </span>
      ) : null}
      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(0, max)}
        value={Math.min(index, Math.max(0, max))}
        aria-label="Match minute"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </footer>
  );
}
