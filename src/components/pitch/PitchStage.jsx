import { useEffect, useState } from "react";
import PitchMarkings from "./PitchMarkings.jsx";
import LiveAction, { MATCH_ANNOUNCE_MS } from "./LiveAction.jsx";
import { MatchAnnounce, endedSlides } from "./EndedCards.jsx";
import { prematchSlides } from "./PrematchCards.jsx";

export default function PitchStage({ match, event, ball, ended, score, playing, preview, playTrack, playIndex }) {
  const [page, setPage] = useState(0);
  const [endBeat, setEndBeat] = useState("live");

  useEffect(() => {
    if (preview || !ended) {
      setEndBeat("live");
      setPage(0);
      return undefined;
    }
    setEndBeat("announce");
    setPage(0);
    const timer = setTimeout(() => setEndBeat("cards"), MATCH_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ended, preview]);

  const slides = preview
    ? prematchSlides(match)
    : ended && endBeat === "cards"
    ? endedSlides(match, score)
    : [["live", (
      <LiveAction
        match={match}
        event={event}
        ball={ball}
        score={score}
        playing={playing}
        playTrack={playTrack}
        playIndex={playIndex}
      />
    )]];

  const current = slides[page] || slides[0];
  const many = slides.length > 1;
  const showAnnounce = !preview && ended && endBeat === "announce";

  return (
    <div className="pitch-wrap">
      <div className="flat-pitch">
        <PitchMarkings />
        {showAnnounce ? (
          <div className="pitch-overlay" data-slide="match-ended-announce">
            <MatchAnnounce title="Match has ended" />
          </div>
        ) : many ? (
          <div className="pitch-carousel">
            <div className="pitch-carousel-row">
              <button
                type="button"
                className="pitch-nav prev"
                aria-label="Previous pitch card"
                onClick={() => setPage((p) => (p + slides.length - 1) % slides.length)}
              >
                <img src="/icons/chevron-left.svg" alt="" />
              </button>
              <div className="pitch-card-shell" data-slide={current[0]}>
                {current[1]}
              </div>
              <button
                type="button"
                className="pitch-nav next"
                aria-label="Next pitch card"
                onClick={() => setPage((p) => (p + 1) % slides.length)}
              >
                <img src="/icons/chevron-right.svg" alt="" />
              </button>
            </div>
            <div className="pitch-dots">
              {slides.map(([id], index) => (
                <button
                  key={id}
                  type="button"
                  className={index === page ? "on" : ""}
                  aria-label={`Pitch card ${index + 1}`}
                  onClick={() => setPage(index)}
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pitch-overlay" data-slide="live">
            {current[1]}
          </div>
        )}
      </div>
    </div>
  );
}
