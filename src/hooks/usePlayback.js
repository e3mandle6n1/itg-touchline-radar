import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ballAt,
  buildIncidentTimeline,
  buildPasses,
  buildPlayTrack,
  displayBall,
  dwellFor,
  incidentIndexAtPlay,
  minuteAt,
  passFrom,
  PASS_SPEED,
  scoreAt,
  travelMs,
} from "../match";

function prevBallIndex(timeline, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (timeline[i]?.x != null && timeline[i]?.y != null) return i;
  }
  return Math.max(0, index - 1);
}

function startPlayIndex(playTrack) {
  const kick = playTrack.findIndex(
    (row) => row.incident === "periodstart" || row.type === "periodstart",
  );
  if (kick >= 0) return kick;
  const atOne = playTrack.findIndex((row) => row.minute === 1);
  return atOne >= 0 ? atOne : 0;
}

export function usePlayback(match, { live = false, feedDone = true } = {}) {
  const situationCount = match?.situations?.length ?? 0;
  const playTrack = useMemo(
    () => buildPlayTrack(match),
    // Rebuild when the live buffer grows; avoid thrashing on identical fixture object churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match?.id, situationCount, live ? situationCount : match],
  );
  const timeline = useMemo(() => buildIncidentTimeline(playTrack), [playTrack]);
  const passes = useMemo(() => buildPasses(playTrack), [playTrack]);
  const playTrackRef = useRef(playTrack);
  const passesRef = useRef(passes);
  playTrackRef.current = playTrack;
  passesRef.current = passes;

  const [index, setIndex] = useState(() => (live ? 0 : startPlayIndex(playTrack)));
  const [playing, setPlaying] = useState(live);
  const [started, setStarted] = useState(live);
  const primed = useRef(false);
  const matchKey = match?.id;

  useEffect(() => {
    primed.current = false;
    setStarted(live);
    setIndex(live ? 0 : startPlayIndex(playTrackRef.current));
    setPlaying(live);
  }, [matchKey, live]);

  // First rows from an empty live buffer: jump to kick-off and follow.
  useEffect(() => {
    if (!live || primed.current || playTrack.length === 0) return;
    primed.current = true;
    setIndex(startPlayIndex(playTrack));
    setPlaying(true);
  }, [live, playTrack.length]);

  const event = playTrack[index];
  const atTip = playTrack.length === 0 || index >= playTrack.length - 1;
  const complete = !live || feedDone;
  const score = useMemo(() => scoreAt(playTrack, index), [playTrack, index]);
  const minute = useMemo(
    () => minuteAt(playTrack, index, { complete }),
    [playTrack, index, complete],
  );
  const rawBall = useMemo(() => ballAt(playTrack, index), [playTrack, index]);
  const activePass = playing ? passFrom(passes, index) : null;
  const ball = useMemo(
    () => (activePass ? activePass.to : displayBall(event, rawBall)),
    [activePass, event, rawBall],
  );
  const ended = atTip && complete && !playing;
  const preview = !live && !started && !playing;
  const eventIndex = useMemo(
    () => incidentIndexAtPlay(timeline, index),
    [timeline, index],
  );

  // Re-arm dwell when the live buffer grows, and keep a heartbeat while waiting on tip
  // so a stalled SSE cannot leave playing=true with no timer forever.
  const tipWaitKey = playing && live && !feedDone && atTip ? playTrack.length : 0;

  const pause = useCallback(() => setPlaying(false), []);

  const seek = useCallback((next) => {
    setStarted(true);
    setPlaying(false);
    const len = playTrackRef.current.length;
    setIndex(Math.max(0, Math.min(Math.max(0, len - 1), next)));
  }, []);

  const seekEvent = useCallback((markIdx) => {
    setStarted(true);
    setPlaying(false);
    const mark = timeline[markIdx];
    if (!mark) return;
    setIndex(Math.max(0, Math.min(playTrack.length - 1, mark.playIndex)));
  }, [timeline, playTrack.length]);

  const toggle = useCallback(() => {
    setStarted(true);
    setPlaying((current) => {
      if (current) return false;
      const track = playTrackRef.current;
      if (live) {
        if (track.length === 0) return true;
        setIndex((i) => (i < track.length - 1 ? i : Math.max(0, track.length - 1)));
        return true;
      }
      setIndex((i) => (i < track.length - 1 ? i : startPlayIndex(track)));
      return true;
    });
  }, [live]);

  useEffect(() => {
    if (!playing) return undefined;
    const track = playTrackRef.current;
    if (track.length === 0) return undefined;
    if (index >= track.length - 1) {
      if (!live || feedDone) {
        setPlaying(false);
        return undefined;
      }
      // Live tip: poll briefly so we notice new situations even if length dep glitches.
      const wait = setTimeout(() => {
        const latest = playTrackRef.current;
        if (latest.length - 1 > index) {
          setIndex((i) => Math.min(i + 1, latest.length - 1));
        }
      }, 320);
      return () => clearTimeout(wait);
    }
    const pass = passFrom(passesRef.current, index);
    const current = track[index];
    const from = ballAt(track, pass ? index : prevBallIndex(track, index));
    const to = pass ? pass.to : displayBall(current, ballAt(track, index));
    // Never advance before the ball can finish the trip — stops trail breaks / teleports.
    const moveMs = travelMs(from, to, PASS_SPEED);
    const holdMs = pass ? 140 : dwellFor(current, from, to);
    const rawMs = Math.max(moveMs + 60, holdMs);
    const ms = Number.isFinite(rawMs) ? Math.max(120, rawMs) : 280;
    const jumpTo = pass ? pass.end : null;
    const timer = setTimeout(() => {
      setIndex((i) => {
        const latest = playTrackRef.current;
        const dest = jumpTo == null ? i + 1 : jumpTo;
        const n = Math.min(dest, Math.max(0, latest.length - 1));
        if (n >= latest.length - 1 && (!live || feedDone)) setPlaying(false);
        return n;
      });
    }, ms);
    return () => clearTimeout(timer);
  }, [playing, index, live, feedDone, tipWaitKey]);

  return {
    timeline,
    playTrack,
    index,
    eventIndex,
    event,
    score,
    minute,
    ball,
    ended,
    preview,
    playing,
    live,
    seek,
    seekEvent,
    pause,
    toggle,
  };
}
