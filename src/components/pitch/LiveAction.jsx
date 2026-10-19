import { useEffect, useMemo, useRef, useState } from "react";
import BallSpot from "./BallSpot.jsx";
import GoalBurst from "./GoalBurst.jsx";
import PitchIncident from "./PitchIncident.jsx";
import SituationBanner from "./SituationBanner.jsx";
import CornerPulse from "./CornerPulse.jsx";
import SetPieceFunnel from "./SetPieceFunnel.jsx";
import GoalTip, { ShotTip, SaveTip, KickoffTip } from "../tips/GoalTip.jsx";
import { BlockedTip, InjuryTip, CornerTip, ThrowInTip } from "../tips/CentreTip.jsx";
import CardTip from "../tips/CardTip.jsx";
import SubTip from "../tips/SubTip.jsx";
import SetPieceTip from "../tips/SetPieceTip.jsx";
import OffsideMark from "../tips/OffsideMark.jsx";
import { MatchAnnounce } from "./EndedCards.jsx";
import { PenAnnounce, PenBanner, PenKickTip, PenTally } from "./PenShootout.jsx";
import {
  EVENT_LABELS,
  cardSpot,
  cornerQuad,
  displayBall,
  firstShootoutTeam,
  goalNetTarget,
  hasSitover,
  isCardEvent,
  isInShootout,
  isRestart,
  MATCH_ANNOUNCE_MS,
  partitionTitle,
  isSetPieceKickMoment,
  isShootoutGoal,
  isShootoutKick,
  isShootoutMissed,
  isShootoutPeriodStart,
  isShootoutScored,
  isShotAttempt,
  saveSpot,
  setPieceDeliveryTarget,
  setPieceSpot,
  shootoutMissTarget,
  shootoutNetTarget,
  shootoutSpot,
  shootoutTally,
  shotFlightTarget,
  shotOrigin,
  situationPhase,
  travelMs,
} from "../../match";

const SITUATION_DWELL_MS = 1600;
const GOAL_TIP_HOLD_MS = 520;
const GOAL_SCORE_MS = 1600;
const FOUL_BEFORE_CARD_MS = 1100;
const PEN_ABOUT_MS = 2000;
const PEN_FIRST_MS = 2000;
const PEN_SPOT_HOLD_MS = 700;

export default function LiveAction({ match, event, ball, score, playing, playTrack = [], playIndex = 0 }) {
  const kind = event?.incident || event?.type;
  const penKick = isShootoutKick(event);
  const penStart = isShootoutPeriodStart(event);
  const inPens = isInShootout(playTrack, playIndex) || penKick || penStart;
  const isGoal = kind === "goal" && hasSitover(event) && !penKick;
  const celebrateGoal = isGoal && !isShootoutGoal(event);
  const isShot = isShotAttempt(event) && !penKick;
  const isBlocked = kind === "shotblocked";
  const isSave = kind === "goalkeeper_saved" && !penKick;
  const isInjury = kind === "injury";
  const isCard = isCardEvent(event);
  const withFreeKick = Boolean(isCard && event?.withFreeKick && event?.foulSpot);
  const isSub = kind === "substitution" && hasSitover(event);
  const isThrowIn = kind === "throwin";
  const isKickoff = isRestart(event) && !penStart;
  const boundaryTitle = partitionTitle(event);
  const boundaryIsStart = boundaryTitle && (kind === "periodstart" || kind === "kickoff");
  const isCorner = kind === "corner";
  const isFreeKick = kind === "freekick" || kind === "freekick_taken";
  const isOffside = kind === "offside";
  const isSetPiece = isCorner || isFreeKick;
  const kickMoment = isSetPiece && isSetPieceKickMoment(event);
  const origin = (isGoal || isShot) ? shotOrigin(event) : null;
  const foulSpot = withFreeKick ? event.foulSpot : null;
  const bookingSpot = isCard ? (foulSpot || cardSpot(event)) : null;
  const net = isGoal ? goalNetTarget(event) : null;
  const shotEnd = isShot ? shotFlightTarget(event) : null;
  const keepSpot = isSave ? saveSpot(event) : null;
  const spot = isSetPiece ? setPieceSpot(event) : null;
  const delivery = kickMoment ? setPieceDeliveryTarget(event) : null;
  const corner = isCorner && spot ? cornerQuad(spot) : null;
  const penOrigin = penKick ? shootoutSpot() : null;
  const penEnd = penKick
    ? (isShootoutScored(event) ? shootoutNetTarget() : shootoutMissTarget(event))
    : null;
  const setPieceKey = isSetPiece
    ? `${kind}-${event?.minute}-${event?.added}-${event?.team}-${spot?.x}-${spot?.y}-${kickMoment}`
    : "";
  const goalKey = isGoal
    ? `goal-${event?.minute}-${event?.added}-${event?.team}-${event?.player}`
    : "";
  const penKey = penKick
    ? `pen-${event?.minute}-${event?.added}-${event?.team}-${event?.player}-${kind}`
    : "";
  const penStartKey = penStart
    ? `pen-start-${event?.minute}-${event?.added}-${event?.clock}`
    : "";
  const cardKey = isCard
    ? `card-${event?.minute}-${event?.added}-${event?.player}-${event?.card}-${withFreeKick}`
    : "";
  const boundaryKey = boundaryTitle
    ? `${kind}-${event?.minute}-${event?.added}-${event?.clock}`
    : "";
  const foulTipEvent = withFreeKick
    ? {
      ...event,
      team: event.foulTeam,
      type: "freekick",
      incident: "freekick",
    }
    : null;

  const [setPiecePhase, setSetPiecePhase] = useState("spot");
  const [goalPhase, setGoalPhase] = useState("flight");
  const goalPhaseRef = useRef("flight");
  const [penPhase, setPenPhase] = useState("spot");
  const penPhaseRef = useRef("spot");
  const [penBeat, setPenBeat] = useState("idle");
  const [cardBeat, setCardBeat] = useState("card");
  const [startBeat, setStartBeat] = useState("idle");
  const startDoneRef = useRef(false);

  const tallyThrough = penKick && penPhase === "spot" ? playIndex - 1 : playIndex;
  const tally = useMemo(
    () => (inPens ? shootoutTally(playTrack, Math.max(-1, tallyThrough)) : null),
    [inPens, playTrack, tallyThrough],
  );
  const firstPenTeam = useMemo(() => firstShootoutTeam(playTrack), [playTrack]);
  const firstPenSide = firstPenTeam === "away" ? match.away : match.home;

  useEffect(() => {
    if (!kickMoment || !spot || !delivery) {
      setSetPiecePhase("spot");
      return undefined;
    }
    setSetPiecePhase("spot");
    const toSpotPad = Math.max(640, travelMs({ x: 50, y: 50 }, spot) + 180);
    const timer = setTimeout(() => setSetPiecePhase("delivery"), toSpotPad);
    return () => clearTimeout(timer);
  }, [setPieceKey, kickMoment, spot, delivery]);

  useEffect(() => {
    goalPhaseRef.current = "flight";
    setGoalPhase("flight");
  }, [goalKey]);

  useEffect(() => {
    penPhaseRef.current = "spot";
    setPenPhase("spot");
  }, [penKey]);

  useEffect(() => {
    if (!penStart) {
      setPenBeat("idle");
      return undefined;
    }
    if (!playing) {
      setPenBeat("settled");
      return undefined;
    }
    setPenBeat("about");
    const toFirst = setTimeout(() => setPenBeat("first"), PEN_ABOUT_MS);
    const toSettle = setTimeout(() => setPenBeat("settled"), PEN_ABOUT_MS + PEN_FIRST_MS);
    return () => {
      clearTimeout(toFirst);
      clearTimeout(toSettle);
    };
  }, [penStartKey, penStart, playing]);

  useEffect(() => {
    if (!penKick || !penOrigin || !penEnd || !playing) return undefined;

    const timers = [];
    const flightMs = Math.max(520, travelMs(penOrigin, penEnd));
    const phase = penPhaseRef.current;

    if (phase === "spot") {
      timers.push(setTimeout(() => {
        penPhaseRef.current = "flight";
        setPenPhase("flight");
      }, PEN_SPOT_HOLD_MS));
      timers.push(setTimeout(() => {
        penPhaseRef.current = "settle";
        setPenPhase("settle");
      }, PEN_SPOT_HOLD_MS + flightMs + GOAL_TIP_HOLD_MS));
    } else if (phase === "flight") {
      timers.push(setTimeout(() => {
        penPhaseRef.current = "settle";
        setPenPhase("settle");
      }, flightMs + GOAL_TIP_HOLD_MS));
    }

    return () => timers.forEach(clearTimeout);
  }, [penKey, penKick, playing, penOrigin?.x, penOrigin?.y, penEnd?.x, penEnd?.y]);

  useEffect(() => {
    if (!withFreeKick) {
      setCardBeat("card");
      return undefined;
    }
    if (!playing) {
      setCardBeat("card");
      return undefined;
    }
    setCardBeat("foul");
    const timer = setTimeout(() => setCardBeat("card"), FOUL_BEFORE_CARD_MS);
    return () => clearTimeout(timer);
  }, [cardKey, withFreeKick, playing]);

  useEffect(() => {
    startDoneRef.current = false;
    setStartBeat(boundaryTitle ? "idle" : "kickoff");
  }, [boundaryKey, boundaryTitle]);

  useEffect(() => {
    if (!boundaryTitle) {
      setStartBeat("kickoff");
      return undefined;
    }
    if (!playing) {
      setStartBeat(startDoneRef.current ? "kickoff" : "idle");
      return undefined;
    }
    if (boundaryIsStart && startDoneRef.current) {
      setStartBeat("kickoff");
      return undefined;
    }
    setStartBeat("announce");
    if (!boundaryIsStart) return undefined;
    const timer = setTimeout(() => {
      startDoneRef.current = true;
      setStartBeat("kickoff");
    }, MATCH_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [boundaryKey, boundaryTitle, boundaryIsStart, playing]);

  useEffect(() => {
    if (!isGoal || !origin || !net || !playing) return undefined;

    const timers = [];
    const flightMs = Math.max(520, travelMs(origin, net));
    const phase = goalPhaseRef.current;

    if (phase === "flight") {
      timers.push(setTimeout(() => {
        goalPhaseRef.current = "score";
        setGoalPhase("score");
      }, flightMs + GOAL_TIP_HOLD_MS));
      timers.push(setTimeout(() => {
        goalPhaseRef.current = "settle";
        setGoalPhase("settle");
      }, flightMs + GOAL_TIP_HOLD_MS + GOAL_SCORE_MS));
    } else if (phase === "score") {
      timers.push(setTimeout(() => {
        goalPhaseRef.current = "settle";
        setGoalPhase("settle");
      }, GOAL_SCORE_MS));
    }

    return () => timers.forEach(clearTimeout);
  }, [goalKey, isGoal, playing, origin?.x, origin?.y, net?.x, net?.y]);

  const ballTarget = penKick && penOrigin && penEnd
    ? (penPhase === "spot" ? penOrigin : penEnd)
    : inPens
      ? shootoutSpot()
      : kickMoment && spot && delivery
        ? (setPiecePhase === "delivery" ? delivery : spot)
        : displayBall(event, ball);

  const phase = situationPhase(event, ballTarget);
  const incident = hasSitover(event);
  const attacking = phase === "attack" || phase === "dangerous";
  const shiftKey =
    !inPens
    && attacking
    && event?.team
    && !incident
    && !isShot
    && !isBlocked
    && !isSave
    && !isInjury
    && !isCard
    && !isKickoff
    && !isSetPiece
    && !isOffside
      ? `${event.team}:${phase}`
      : null;

  const prevKeyRef = useRef(null);
  const [shiftPulse, setShiftPulse] = useState(null);

  useEffect(() => {
    if (!shiftKey) {
      prevKeyRef.current = null;
      setShiftPulse(null);
      return;
    }
    if (shiftKey === prevKeyRef.current) return;
    prevKeyRef.current = shiftKey;
    const [team, nextPhase] = shiftKey.split(":");
    setShiftPulse({ team, phase: nextPhase });
  }, [shiftKey]);

  useEffect(() => {
    if (!shiftPulse) return undefined;
    const timer = setTimeout(() => setShiftPulse(null), SITUATION_DWELL_MS);
    return () => clearTimeout(timer);
  }, [shiftPulse]);

  const showSituation = Boolean(shiftPulse);
  const bannerEvent = shiftPulse
    ? { ...event, team: shiftPulse.team }
    : event;
  const bannerPhase = shiftPulse?.phase ?? phase;

  const label = EVENT_LABELS[event?.type];
  const showLabel = Boolean(label)
    && event?.x != null
    && !incident
    && !showSituation
    && !inPens
    && !isGoal
    && !isShot
    && !isBlocked
    && !isSave
    && !isInjury
    && !isCard
    && !isSub
    && !isThrowIn
    && !isKickoff
    && !isSetPiece
    && !isOffside;

  const showPenHud = inPens && (!penStart || penBeat === "settled" || !playing);
  const penTipMode = penPhase === "spot"
    ? "player"
    : isShootoutScored(event)
      ? "scored"
      : "missed";

  return (
    <>
      <BallSpot
        ball={ballTarget}
        playing={playing}
        team={event?.team}
        muted={(isGoal && goalPhase === "score") || (penKick && penPhase === "spot")}
        shotOrigin={penKick ? penOrigin : isSetPiece ? spot : origin}
        goalFlight={isGoal || (penKick && isShootoutScored(event) && penPhase !== "spot")}
        shotFlight={(isShot && Boolean(shotEnd)) || (penKick && isShootoutMissed(event) && penPhase !== "spot")}
        cornerFlight={kickMoment && setPiecePhase === "delivery"}
      />
      {penStart && penBeat === "about" ? (
        <PenAnnounce
          key={`pen-about-${penStartKey}`}
          icon="/icons/goal.svg"
          title="Penalty Shootout"
          subtitle="About To Start"
        />
      ) : null}
      {penStart && penBeat === "first" ? (
        <PenAnnounce
          key={`pen-first-${penStartKey}`}
          jersey={firstPenSide.crest || "/icons/jersey-home.svg"}
          title={firstPenSide.name}
          subtitle="Taking The First Kick"
        />
      ) : null}
      {showPenHud ? (
        <>
          <PenBanner />
          <PenTally match={match} tally={tally} />
        </>
      ) : null}
      {penKick && penOrigin ? (
        <PenKickTip
          key={penKey}
          match={match}
          event={event}
          at={penOrigin}
          mode={penTipMode}
        />
      ) : null}
      {isGoal && origin ? (
        <GoalTip
          key={goalKey}
          match={match}
          event={event}
          at={origin}
          variant={goalPhase === "settle" ? "simple" : "rich"}
        />
      ) : null}
      {isShot && origin && shotEnd ? (
        <ShotTip
          key={`shot-${event?.minute}-${event?.added}-${event?.player}-${kind}`}
          match={match}
          event={event}
          at={origin}
        />
      ) : null}
      {isBlocked ? (
        <BlockedTip
          key={`blocked-${event?.minute}-${event?.added}-${event?.player}-${event?.team}`}
          match={match}
          event={event}
        />
      ) : null}
      {isSave && keepSpot ? (
        <SaveTip
          key={`save-${event?.minute}-${event?.added}-${event?.team}`}
          match={match}
          event={event}
          at={keepSpot}
        />
      ) : null}
      {isInjury ? (
        <InjuryTip
          key={`injury-${event?.minute}-${event?.added}-${event?.player}-${event?.team}`}
          match={match}
          event={event}
        />
      ) : null}
      {boundaryTitle && startBeat === "announce" ? (
        <MatchAnnounce key={`boundary-${boundaryKey}`} title={boundaryTitle} />
      ) : null}
      {isKickoff && (!boundaryIsStart || startBeat === "kickoff") ? (
        <KickoffTip
          key={`kickoff-${kind}-${event?.minute}-${event?.added}-${event?.clock}`}
          match={match}
          event={event}
        />
      ) : null}
      {isCard && withFreeKick && cardBeat === "foul" && foulSpot && foulTipEvent ? (
        <>
          <SetPieceFunnel
            key={`foul-funnel-${cardKey}`}
            at={foulSpot}
            team={event.foulTeam}
            kind="freekick"
          />
          <SetPieceTip
            key={`foul-tip-${cardKey}`}
            match={match}
            event={foulTipEvent}
            at={foulSpot}
            kind="freekick"
            taken
          />
        </>
      ) : null}
      {isCard && bookingSpot && (!withFreeKick || cardBeat === "card") ? (
        <CardTip
          key={cardKey}
          match={match}
          event={event}
          at={bookingSpot}
          playing={playing}
        />
      ) : null}
      {isSub ? (
        <SubTip
          key={`sub-${event?.minute}-${event?.added}-${event?.team}-${event?.player}`}
          match={match}
          event={event}
        />
      ) : null}
      {isThrowIn ? (
        <ThrowInTip
          key={`throwin-${event?.minute}-${event?.added}-${event?.team}-${event?.x}-${event?.y}`}
          match={match}
          event={event}
        />
      ) : null}
      {isOffside ? (
        <OffsideMark
          key={`offside-${event?.minute}-${event?.added}-${event?.team}-${event?.x}`}
          match={match}
          event={event}
        />
      ) : null}
      {isCorner && spot ? (
        <>
          <CornerPulse key={`cpulse-${setPieceKey}`} at={spot} />
          {kickMoment ? (
            <SetPieceFunnel
              key={`funnel-${setPieceKey}`}
              at={spot}
              team={event?.team}
              kind="corner"
              corner={corner}
            />
          ) : null}
          <CornerTip
            key={`corner-${setPieceKey}`}
            match={match}
            event={event}
          />
        </>
      ) : null}
      {isFreeKick && spot ? (
        <>
          {kickMoment ? (
            <SetPieceFunnel
              key={`funnel-${setPieceKey}`}
              at={spot}
              team={event?.team}
              kind="freekick"
            />
          ) : null}
          <SetPieceTip
            match={match}
            event={event}
            at={spot}
            kind="freekick"
            taken={kickMoment}
          />
        </>
      ) : null}
      {showLabel && (
        <span className="event-badge" style={{ left: `${ballTarget.x}%`, top: `${ballTarget.y}%` }}>
          {label}
        </span>
      )}
      {showSituation && (
        <SituationBanner match={match} event={bannerEvent} phase={bannerPhase} />
      )}
      {celebrateGoal && goalPhase === "score" ? (
        <GoalBurst key={`${goalKey}-burst`} event={event} />
      ) : null}
      {isGoal && goalPhase === "score" && !celebrateGoal ? (
        <PitchIncident
          key={`${goalKey}-score`}
          match={match}
          event={event}
          score={score}
        />
      ) : null}
      {!inPens && !isGoal && !isCard && !isSub && !isThrowIn && !isCorner && !isShot && !isBlocked && !isSave && !isInjury
        && !(boundaryIsStart && startBeat !== "kickoff") ? (
        <PitchIncident
          key={`${event?.type}-${event?.minute}-${event?.added}-${event?.player}-${score.home}-${score.away}`}
          match={match}
          event={event}
          score={score}
        />
      ) : null}
    </>
  );
}

export { MATCH_ANNOUNCE_MS };
