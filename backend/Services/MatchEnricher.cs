using System.Text.Json;
using Touchline.Api.Models;

namespace Touchline.Api.Services;

public static class MatchEnricher
{
    static readonly HashSet<string> Incident = new(StringComparer.Ordinal)
    {
        "goal", "card", "substitution", "corner", "shotontarget", "shotofftarget",
        "shotblocked", "goalkeeper_saved", "offside", "injury", "freekick",
        "freekick_taken", "throwin", "goal_kick", "periodstart", "periodscore",
        "match_ended", "kickoff",
        "pass", "tackle", "interception", "pressure", "possession",
    };

    static readonly (double X, double Y) Centre = (50, 50);

    static double Hypot(double a, double b) => Math.Sqrt(a * a + b * b);

    public static MatchDto Enrich(MatchDto match)
    {
        var next = Clone(match);
        next.Events = FixPeriodBoundaries(next.Events ?? [])
            .Select((e, i) => (Event: e, Key: PitchUtil.TimeKey(e) + i / 1e6))
            .OrderBy(x => x.Key)
            .Select(x => x.Event)
            .ToList();

        var feed = next.Events
            .Where(e => Incident.Contains(e.Type) || (e.X is not null && e.Y is not null))
            .ToList();

        var situations = new List<Situation>();
        MatchEvent? prev = null;
        var prevT = -0.01;
        var lastBall = (X: 50.0, Y: 50.0, Team: "home");

        foreach (var ev in feed)
        {
            if (prev?.Type == "match_ended") break;

            var isPeriodStart = ev.Type == "periodstart";
            var placed = PlacedSpot(ev);
            var hasPitch = ev.X is not null && ev.Y is not null;
            var x = isPeriodStart ? Centre.X : placed?.X ?? (hasPitch ? PitchUtil.Clamp(ev.X) : lastBall.X);
            var y = isPeriodStart ? Centre.Y : placed?.Y ?? (hasPitch ? PitchUtil.Clamp(ev.Y) : lastBall.Y);
            var team = ev.Team ?? lastBall.Team;

            var t = PitchUtil.TimeKey(ev);
            if (t < prevT) t = prevT + 0.02;

            var cur = CloneEvent(ev, x, y, team);

            if (prev is not null)
            {
                var fromKickoff = prev.Type is "periodstart" or "kickoff";
                var toRestart = ev.Type is "throwin" or "goal_kick" or "corner" or "freekick" or "freekick_taken";
                if (fromKickoff && toRestart)
                    situations.AddRange(KickoffBuild(prev, cur, prevT, Math.Max(prevT + 0.55, t)));
                else
                    situations.AddRange(Interpolate(prev, cur, prevT, t, fromKickoff));
            }

            (int Minute, int Added, string Clock) shown;
            if (ev.Type is "periodstart" or "periodscore" or "match_ended")
            {
                var fallback = PitchUtil.SplitTime(t);
                shown = (
                    ev.Minute ?? fallback.Minute,
                    ev.Added,
                    string.IsNullOrEmpty(ev.Clock) ? fallback.Clock : ev.Clock!
                );
            }
            else
            {
                var sourceT = ev.Minute is not null ? PitchUtil.TimeKey(ev) : (double?)null;
                var useSource = sourceT is not null && sourceT >= prevT - 0.001;
                shown = useSource
                    ? (ev.Minute!.Value, ev.Added, string.IsNullOrEmpty(ev.Clock) ? PitchUtil.ClockOf(ev.Minute, ev.Added) : ev.Clock!)
                    : PitchUtil.SplitTime(t);
            }

            situations.Add(Spot(cur, new SpotOpts
            {
                Incident = Incident.Contains(ev.Type) ? ev.Type : null,
                Minute = shown.Minute,
                Added = shown.Added,
                Clock = shown.Clock,
                Phase = isPeriodStart ? "safe" : PitchUtil.PossessionPhase(team, x),
            }));

            prev = cur;
            prevT = t;
            lastBall = (x, y, team);

            if (ev.Type == "goal" && ev.Shootout != true)
            {
                var kickTeam = ev.Team == "away" ? "home" : "away";
                var kickT = prevT + 0.12;
                var kickShown = PitchUtil.SplitTime(kickT);
                var kickCur = new MatchEvent
                {
                    Type = "kickoff",
                    Team = kickTeam,
                    X = Centre.X,
                    Y = Centre.Y,
                };
                situations.AddRange(Interpolate(prev, kickCur, prevT, kickT));
                situations.Add(Spot(kickCur, new SpotOpts
                {
                    Incident = "kickoff",
                    Minute = kickShown.Minute,
                    Added = kickShown.Added,
                    Clock = kickShown.Clock,
                    Phase = "safe",
                    Team = kickTeam,
                    X = Centre.X,
                    Y = Centre.Y,
                }));
                prev = kickCur;
                prevT = kickT;
                lastBall = (Centre.X, Centre.Y, kickTeam);
            }
        }

        var deduped = new List<Situation>();
        foreach (var row in situations)
        {
            var prevRow = deduped.Count > 0 ? deduped[^1] : null;
            if (prevRow is not null
                && prevRow.Team == row.Team
                && prevRow.Phase == row.Phase
                && row.Incident is null
                && prevRow.Incident is null
                && Hypot(prevRow.X - row.X, prevRow.Y - row.Y) < 1.8)
            {
                continue;
            }
            deduped.Add(row);
        }

        next.Situations = deduped;
        MatchInsightEnricher.Annotate(next);
        return next;
    }

    sealed class SpotOpts
    {
        public string? Incident { get; set; }
        public int? Minute { get; set; }
        public int? Added { get; set; }
        public string? Clock { get; set; }
        public string? Phase { get; set; }
        public string? Team { get; set; }
        public double? X { get; set; }
        public double? Y { get; set; }
        public string? Type { get; set; }
    }

    static MatchDto Clone(MatchDto match) =>
        JsonSerializer.Deserialize<MatchDto>(JsonSerializer.Serialize(match))!;

    static MatchEvent CloneEvent(MatchEvent e, double x, double y, string team) => new()
    {
        Type = e.Type,
        Team = team,
        Minute = e.Minute,
        Added = e.Added,
        Clock = e.Clock,
        Score = e.Score,
        X = x,
        Y = y,
        Player = e.Player,
        Text = e.Text,
        Card = e.Card,
        Shootout = e.Shootout,
        Period = e.Period,
        Outcome = e.Outcome,
        Distance = e.Distance,
        Difficulty = e.Difficulty,
        Speed = e.Speed,
    };

    static List<MatchEvent> FixPeriodBoundaries(List<MatchEvent> events)
    {
        var list = events.ToList();
        var scoreAt = list.FindIndex(e =>
            e.Type == "periodscore" && (
                (e.Clock ?? "").Contains("1st", StringComparison.OrdinalIgnoreCase)
                || (e.Clock ?? "").Contains("first", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("1st", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("first", StringComparison.OrdinalIgnoreCase)));
        var startAt = list.FindIndex(e =>
            e.Type == "periodstart" && (
                (e.Clock ?? "").Contains("2nd", StringComparison.OrdinalIgnoreCase)
                || (e.Clock ?? "").Contains("second", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("2nd", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("second", StringComparison.OrdinalIgnoreCase)));
        if (scoreAt < 0 || startAt < 0 || scoreAt >= startAt - 1) return list;
        var row = list[scoreAt];
        list.RemoveAt(scoreAt);
        var insertAt = list.FindIndex(e =>
            e.Type == "periodstart" && (
                (e.Clock ?? "").Contains("2nd", StringComparison.OrdinalIgnoreCase)
                || (e.Clock ?? "").Contains("second", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("2nd", StringComparison.OrdinalIgnoreCase)
                || (e.Text ?? "").Contains("second", StringComparison.OrdinalIgnoreCase)));
        list.Insert(insertAt, row);
        return list;
    }

    static (double X, double Y)? PlacedSpot(MatchEvent ev)
    {
        var restart = ev.Type is "throwin" or "freekick";
        var depth = PitchUtil.AttackDepth(ev.Team, ev.X) ?? (restart ? 40.0 : (double?)null);
        if (depth is null) return null;

        double XOf(double d) => PitchUtil.Clamp(ev.Team == "home" ? d : 100 - d);
        var y = ev.Y ?? 50;
        var text = ev.Text ?? "";
        var danger = ContainsAny(text, "good position", "getting dangerous", "dangerous", "shooting range",
            "close to the penalty", "just outside", "deep inside", "penalty box", "need to be alert", "'s area");
        var opp = ContainsAny(text, "territory", "half of", "attacking", "high up", "opposite half", "'s half");
        var own = ContainsAny(text, "own half", "in their half", "ball safe");

        if (ev.Type == "corner")
            return (XOf(94), text.Contains("left", StringComparison.OrdinalIgnoreCase) || y >= 50 ? 94 : 6);
        if (ev.Type == "goal_kick") return (XOf(8), 50);
        if (ev.Type is "goal" or "shotontarget" or "shotofftarget" or "shotblocked" or "goalkeeper_saved")
            return (XOf(depth >= PitchUtil.DangerFrom ? depth.Value : 84), PitchUtil.Clamp(y));
        if (ev.Type == "offside")
            return (XOf(depth >= PitchUtil.AttackFrom ? depth.Value : 68), PitchUtil.Clamp(y));
        if (!restart) return null;

        var spot = depth.Value;
        if (danger) spot = depth >= PitchUtil.DangerFrom ? depth.Value : 78;
        else if (own && !opp) spot = depth < 50 ? depth.Value : 35;
        else if (opp) spot = depth >= PitchUtil.AttackFrom ? depth.Value : 66;
        return (XOf(spot), ev.Type == "throwin" ? (y >= 50 ? 94 : 6) : PitchUtil.Clamp(y));
    }

    static bool ContainsAny(string text, params string[] needles) =>
        needles.Any(n => text.Contains(n, StringComparison.OrdinalIgnoreCase));

    static Situation Spot(MatchEvent ev, SpotOpts o)
    {
        var x = PitchUtil.Clamp(o.X ?? ev.X ?? 50);
        var y = PitchUtil.Clamp(o.Y ?? ev.Y ?? 50);
        var team = o.Team ?? ev.Team;
        var minute = o.Minute ?? ev.Minute;
        var added = o.Added ?? ev.Added;
        var row = new Situation
        {
            Minute = minute,
            Added = added,
            Clock = o.Clock ?? ev.Clock ?? PitchUtil.ClockOf(minute, added),
            Team = team,
            Phase = o.Phase ?? PitchUtil.PossessionPhase(team, x),
            X = x,
            Y = y,
            Type = o.Type,
        };
        if (o.Incident is not null)
        {
            row.Incident = o.Incident;
            if (ev.Player is not null) row.Player = ev.Player;
            if (ev.Text is not null) row.Text = ev.Text;
            if (ev.Card is not null) row.Card = ev.Card;
            if (ev.Shootout == true) row.Shootout = true;
            if (ev.Period is not null) row.Period = ev.Period;
            if (ev.Outcome is not null) row.Outcome = ev.Outcome;
            if (ev.Distance is not null) row.Distance = ev.Distance;
            if (ev.Difficulty is not null) row.Difficulty = ev.Difficulty;
            if (ev.Speed is not null) row.Speed = ev.Speed;
        }
        return row;
    }

    static List<(double X, double Y, string? Team)> PassTargets(MatchEvent a, MatchEvent b, bool opening)
    {
        var ax = PitchUtil.Clamp(a.X);
        var ay = PitchUtil.Clamp(a.Y);
        var bx = PitchUtil.Clamp(b.X);
        var by = PitchUtil.Clamp(b.Y);
        var dist = Hypot(bx - ax, by - ay);
        if (dist < 4) return [];

        var stride = opening ? 9.0 : 12.0;
        var passes = Math.Max(2, Math.Min(opening ? 10 : 7, (int)Math.Round(dist / stride)));
        var dx = bx - ax;
        var dy = by - ay;
        var len = Hypot(dx, dy);
        if (len == 0) len = 1;
        var nx = -dy / len;
        var ny = dx / len;
        var seed = (int)Math.Round(ax * 17 + ay * 31 + bx * 13 + by * 7);
        var pts = new List<(double X, double Y, string? Team)>();

        for (var i = 1; i < passes; i++)
        {
            var u = (double)i / passes;
            var along = PitchUtil.EaseInOut(u);
            var side = i % 2 == 0 ? 1 : -1;
            var wobble = (opening ? 7.5 : 5.5) * side * (0.55 + 0.45 * PitchUtil.Hash01(seed + i));
            var drift = (PitchUtil.Hash01(seed + i * 3) - 0.5) * (opening ? 4 : 2.5);
            pts.Add((
                PitchUtil.Clamp(PitchUtil.Lerp(ax, bx, along) + nx * wobble + nx * drift * 0.3),
                PitchUtil.Clamp(PitchUtil.Lerp(ay, by, along) + ny * wobble + ny * drift),
                PassTeam(a.Team, b.Team, u)
            ));
        }
        return pts;
    }

    static string? PassTeam(string? fromTeam, string? toTeam, double u)
    {
        if (!string.IsNullOrEmpty(fromTeam) && !string.IsNullOrEmpty(toTeam) && fromTeam != toTeam)
            return u < 0.4 ? fromTeam : toTeam;
        if (u < 0.72) return fromTeam ?? toTeam;
        return toTeam ?? fromTeam;
    }

    static List<Situation> SamplePass(
        (double X, double Y, string? Team) from,
        (double X, double Y, string? Team) to,
        double fromT,
        double toT,
        string? teamHold)
    {
        var ax = PitchUtil.Clamp(from.X);
        var ay = PitchUtil.Clamp(from.Y);
        var bx = PitchUtil.Clamp(to.X);
        var by = PitchUtil.Clamp(to.Y);
        var dist = Hypot(bx - ax, by - ay);
        var steps = Math.Max(2, Math.Min(6, (int)Math.Round(dist / 4.5)));
        var outList = new List<Situation>();
        var tEnd = Math.Max(fromT + 0.008, toT);
        var prevX = ax;

        for (var i = 1; i <= steps; i++)
        {
            var u = PitchUtil.EaseInOut((double)i / steps);
            var team = i < steps ? teamHold : (to.Team ?? teamHold);
            var x = PitchUtil.Lerp(ax, bx, u);
            var y = PitchUtil.Lerp(ay, by, u);
            var shown = PitchUtil.SplitTime(PitchUtil.Lerp(fromT, tEnd, u));
            outList.Add(Spot(new MatchEvent { Team = team, X = x, Y = y }, new SpotOpts
            {
                Team = team,
                X = x,
                Y = y,
                Minute = shown.Minute,
                Added = shown.Added,
                Clock = shown.Clock,
                Type = "match_action",
                Phase = PitchUtil.PossessionPhase(team, PitchUtil.Clamp(x), prevX),
            }));
            prevX = x;
        }
        return outList;
    }

    static List<Situation> Interpolate(MatchEvent a, MatchEvent b, double fromT, double toT, bool opening = false)
    {
        var ax = PitchUtil.Clamp(a.X);
        var ay = PitchUtil.Clamp(a.Y);
        var bx = PitchUtil.Clamp(b.X);
        var by = PitchUtil.Clamp(b.Y);
        var dist = Hypot(bx - ax, by - ay);
        if (dist < 3.2) return [];

        var targets = PassTargets(a, b, opening);
        var chain = new List<(double X, double Y, string? Team)>
        {
            (ax, ay, a.Team),
        };
        chain.AddRange(targets);
        chain.Add((bx, by, b.Team ?? a.Team));

        var tEnd = Math.Max(fromT + 0.02, toT);
        var outList = new List<Situation>();

        for (var i = 0; i < chain.Count - 1; i++)
        {
            var segFrom = chain[i];
            var segTo = chain[i + 1];
            var segStart = PitchUtil.Lerp(fromT, tEnd, (double)i / (chain.Count - 1));
            var segEnd = PitchUtil.Lerp(fromT, tEnd, (double)(i + 1) / (chain.Count - 1));
            var hold = segFrom.Team ?? a.Team;
            var samples = SamplePass(segFrom, segTo, segStart, segEnd, hold);
            if (samples.Count > 0)
                outList.AddRange(samples.Take(samples.Count - 1));
        }
        return outList;
    }

    static List<Situation> KickoffBuild(MatchEvent from, MatchEvent to, double fromT, double toT)
    {
        var bx = PitchUtil.Clamp(to.X);
        var by = PitchUtil.Clamp(to.Y);
        var team = from.Team ?? to.Team ?? "home";
        var towardTouch = by < 50 ? 1 : -1;
        var midY = 50 + towardTouch * 8.0;
        var mid = new List<(double X, double Y, string Team)>
        {
            (50 + (team == "away" ? -6 : 6), midY, team),
            (46 + (team == "away" ? -8 : 10), midY + towardTouch * 6, team),
            (PitchUtil.Lerp(50, bx, 0.45), PitchUtil.Lerp(50, by, 0.35), team),
            (PitchUtil.Lerp(50, bx, 0.72), PitchUtil.Lerp(50, by, 0.7), team),
        };

        var tMid = fromT + Math.Max(0.35, (toT - fromT) * 0.55);
        var outList = new List<Situation>();
        var prev = new MatchEvent { X = 50, Y = 50, Team = team, Type = from.Type };
        var prevTime = fromT;

        for (var i = 0; i < mid.Count; i++)
        {
            var next = mid[i];
            var t = PitchUtil.Lerp(fromT, tMid, (double)(i + 1) / mid.Count);
            var nextEv = new MatchEvent { X = next.X, Y = next.Y, Team = next.Team };
            outList.AddRange(Interpolate(prev, nextEv, prevTime, t, opening: true));
            var shown = PitchUtil.SplitTime(t);
            outList.Add(Spot(nextEv, new SpotOpts
            {
                Team = next.Team,
                X = next.X,
                Y = next.Y,
                Minute = shown.Minute,
                Added = shown.Added,
                Clock = shown.Clock,
                Type = "match_action",
                Phase = PitchUtil.PossessionPhase(next.Team, PitchUtil.Clamp(next.X), prev.X),
            }));
            prev = nextEv;
            prevTime = t;
        }

        outList.AddRange(Interpolate(prev, to, prevTime, toT, opening: true));
        return outList;
    }
}
