import { useEffect, useReducer } from "react";
import { feedMatch } from "../feed.js";

const empty = {
  fixture: null,
  total: 0,
  situations: [],
  held: [],
  running: true,
  error: "",
};

function reduce(state, action) {
  if (action.type === "reset") return empty;
  if (action.type === "fixture") {
    return { ...state, fixture: action.fixture, total: action.total, error: "" };
  }
  if (action.type === "situation") {
    if (!state.running) return { ...state, held: state.held.concat(action.situation) };
    return { ...state, situations: state.situations.concat(action.situation) };
  }
  if (action.type === "pause") return { ...state, running: false };
  if (action.type === "resume") {
    return { ...state, running: true, situations: state.situations.concat(state.held), held: [] };
  }
  if (action.type === "error" && !state.fixture) return { ...state, error: action.error };
  return state;
}

export function useHubFeed(matchId, { enabled = false } = {}) {
  const [state, dispatch] = useReducer(reduce, empty);

  useEffect(() => {
    dispatch({ type: "reset" });
    if (!enabled || !matchId) return undefined;
    const source = new EventSource(`/live/${encodeURIComponent(matchId)}`);
    source.addEventListener("fixture", (event) => {
      const message = JSON.parse(event.data);
      dispatch({ type: "fixture", fixture: message.fixture, total: message.situationCount });
    });
    source.addEventListener("situation", (event) => {
      const message = JSON.parse(event.data);
      dispatch({ type: "situation", situation: message.situation });
    });
    source.onerror = () => dispatch({ type: "error", error: "Feed is not reachable." });
    return () => source.close();
  }, [enabled, matchId]);

  const received = state.situations.length;
  const done = state.total > 0 && received >= state.total && state.held.length === 0;

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
