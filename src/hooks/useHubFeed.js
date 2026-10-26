import { useEffect, useReducer, useRef } from "react";
import { feedMatch } from "../feed.js";

const empty = {
  fixture: null,
  total: 0,
  situations: [],
  held: [],
  running: true,
  error: "",
  stalled: false,
};

function reduce(state, action) {
  if (action.type === "reset") return empty;
  if (action.type === "fixture") {
    return {
      ...state,
      fixture: action.fixture,
      total: action.total,
      situations: [],
      held: [],
      error: "",
      stalled: false,
    };
  }
  if (action.type === "situations") {
    const batch = action.situations || [];
    if (!batch.length) return state;
    if (!state.running) return { ...state, held: state.held.concat(batch), stalled: false };
    return { ...state, situations: state.situations.concat(batch), stalled: false };
  }
  if (action.type === "pause") return { ...state, running: false };
  if (action.type === "resume") {
    return { ...state, running: true, situations: state.situations.concat(state.held), held: [] };
  }
  if (action.type === "stalled") {
    if (state.stalled && state.fixture) return state;
    // No fixture yet: surface the error so the UI does not sit on "Loading…" forever.
    if (!state.fixture) {
      return { ...state, stalled: true, error: action.error || "Feed is not reachable." };
    }
    return {
      ...state,
      stalled: true,
      error: state.situations.length ? "" : (action.error || "Feed stalled."),
    };
  }
  if (action.type === "error" && !state.fixture) return { ...state, error: action.error };
  return state;
}

export function useHubFeed(matchId, { enabled = false } = {}) {
  const [state, dispatch] = useReducer(reduce, empty);
  const pendingRef = useRef([]);
  const flushTimerRef = useRef(0);

  useEffect(() => {
    dispatch({ type: "reset" });
    if (!enabled || !matchId) return undefined;

    let closed = false;
    let source;
    let reconnectTimer = 0;
    let attempts = 0;

    const flush = () => {
      flushTimerRef.current = 0;
      if (!pendingRef.current.length) return;
      const batch = pendingRef.current;
      pendingRef.current = [];
      dispatch({ type: "situations", situations: batch });
    };

    const queueSituation = (situation) => {
      pendingRef.current.push(situation);
      if (flushTimerRef.current) return;
      // Batch hub ticks so React is not rebuilt per situation (esp. on SSE replay).
      flushTimerRef.current = window.setTimeout(flush, 80);
    };

    const connect = () => {
      if (closed) return;
      source = new EventSource(`/live/${encodeURIComponent(matchId)}`);
      source.addEventListener("fixture", (event) => {
        attempts = 0;
        pendingRef.current = [];
        if (flushTimerRef.current) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = 0;
        }
        const message = JSON.parse(event.data);
        dispatch({ type: "fixture", fixture: message.fixture, total: message.situationCount });
      });
      source.addEventListener("situation", (event) => {
        attempts = 0;
        const message = JSON.parse(event.data);
        if (message.situation) queueSituation(message.situation);
      });
      source.onerror = () => {
        source.close();
        flush();
        dispatch({ type: "stalled", error: "Feed is not reachable." });
        if (closed) return;
        attempts += 1;
        const wait = Math.min(8000, 500 * attempts);
        reconnectTimer = window.setTimeout(connect, wait);
      };
    };

    connect();

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = 0;
      pendingRef.current = [];
      source?.close();
    };
  }, [enabled, matchId]);

  const received = state.situations.length;
  const done = (state.total > 0 && received >= state.total && state.held.length === 0)
    || (state.stalled && received > 0);

  return {
    match: feedMatch({ fixture: state.fixture, situations: state.situations }),
    error: state.error,
    streaming: enabled && state.running && state.fixture && !done,
    done,
    running: state.running,
    received,
    total: state.total,
    pause: () => dispatch({ type: "pause" }),
    resume: () => dispatch({ type: "resume" }),
  };
}
