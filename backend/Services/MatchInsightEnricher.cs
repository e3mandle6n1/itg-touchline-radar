using Touchline.Api.Models;

namespace Touchline.Api.Services;

/// <summary>
/// Deterministic Interpret → Explain pass over enriched situations.
/// Attaches why-it-matters copy, match state, and metric flashes without an LLM.
/// </summary>
public static class MatchInsightEnricher
{
    static readonly HashSet<string> Key = new(StringComparer.Ordinal)
    {
        "goal", "shotontarget", "shotofftarget", "shotblocked", "goalkeeper_saved",
        "card", "tackle", "interception", "pressure", "corner", "offside",
        "substitution", "periodscore", "match_ended", "pass",
    };

    public static void Annotate(MatchDto match)
    {
        var situations = match.Situations;
        if (situations is null || situations.Count == 0) return;

        var home = match.Home?.Name ?? "Home";
        var away = match.Away?.Name ?? "Away";

        for (var i = 0; i < situations.Count; i++)
        {
            var row = situations[i];
            var kind = row.Incident ?? row.Type;
            if (string.IsNullOrEmpty(kind) || kind == "match_action") continue;
            if (!Key.Contains(kind)) continue;

            var window = Recent(situations, i, 14);
            var state = DeriveState(window, row);
            var metric = MetricFlash(row);
            var copy = BuildCopy(kind, row, window, state, home, away);
            var importance = Importance(kind, state, row);

            if (importance is null && metric is null) continue;

            row.State = state;
            row.Importance = importance ?? "low";
            row.Casual = copy.Casual;
            row.Analyst = copy.Analyst;
            if (!string.IsNullOrEmpty(copy.Why)) row.Why = copy.Why;
            if (metric is not null)
            {
                row.MetricLabel = metric.Value.Label;
                row.MetricDetail = metric.Value.Detail;
            }
        }
    }

    static List<Situation> Recent(List<Situation> all, int index, int window)
    {
        var start = Math.Max(0, index - window);
        var list = new List<Situation>();
        for (var i = start; i <= index; i++)
        {
            var row = all[i];
            var kind = row.Incident ?? row.Type;
            if (string.IsNullOrEmpty(kind) || kind == "match_action") continue;
            list.Add(row);
        }
        return list;
    }

    static int Count(List<Situation> rows, string team, params string[] kinds)
    {
        var set = new HashSet<string>(kinds, StringComparer.Ordinal);
        return rows.Count(r => set.Contains(r.Incident ?? r.Type ?? "") && (team == "" || r.Team == team));
    }

    static string DeriveState(List<Situation> rows, Situation ev)
    {
        var team = ev.Team;
        if (string.IsNullOrEmpty(team)) return "transition";
        var shots = Count(rows, team, "shotontarget", "shotofftarget", "shotblocked", "goalkeeper_saved", "goal");
        var presses = Count(rows, team, "pressure", "tackle", "interception");
        var opp = team == "home" ? "away" : "home";
        var oppShots = Count(rows, opp, "shotontarget", "shotofftarget", "shotblocked", "goalkeeper_saved", "goal");
        var attacking = team == "home" ? ev.X >= 60 : ev.X <= 40;

        if (shots >= 3 || (shots >= 2 && presses >= 2)) return "siege";
        if (presses >= 3 && attacking) return "chaos";
        if (oppShots >= 2 && shots == 0) return "transition";
        if (Count(rows, team, "pass", "possession") >= 4 && shots <= 1) return "control";
        if (attacking && (shots >= 1 || presses >= 1)) return "chaos";
        return "control";
    }

    static (string Label, string Detail)? MetricFlash(Situation row)
    {
        var kind = row.Incident ?? row.Type;
        if (kind == "pass")
        {
            var distance = row.Distance ?? 0;
            var speed = row.Speed ?? 0;
            var hard = string.Equals(row.Difficulty, "hard", StringComparison.OrdinalIgnoreCase) || distance >= 28;
            if (hard && distance > 0)
                return ($"{Math.Round(distance)}m · {row.Difficulty ?? "hard"}",
                    $"Pass quality · {row.Difficulty ?? "hard"} · {Math.Round(distance)}m");
            if (speed >= 65)
                return ($"{Math.Round(speed)} km/h", $"Ball speed · {Math.Round(speed)} km/h");
        }
        return null;
    }

    static string? Importance(string kind, string state, Situation row)
    {
        if (kind is "goal" or "periodscore" or "match_ended" or "card" or "goalkeeper_saved") return "high";
        if (kind is "shotontarget" or "shotblocked") return state == "siege" ? "high" : "medium";
        if (kind is "shotofftarget" or "corner") return "medium";
        if (kind is "tackle" or "interception") return state is "chaos" or "siege" ? "medium" : "low";
        if (kind == "pressure" && state == "siege") return "medium";
        if (kind == "pass" && (string.Equals(row.Difficulty, "hard", StringComparison.OrdinalIgnoreCase) || (row.Distance ?? 0) >= 28))
            return "medium";
        if (kind is "substitution" or "offside" or "pass" or "pressure") return "low";
        return "low";
    }

    static string Family(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var i = name.IndexOf(',');
        return i > 0 ? name[..i].Trim() : name.Trim();
    }

    static (string Casual, string Analyst, string? Why) BuildCopy(
        string kind, Situation row, List<Situation> window, string state, string home, string away)
    {
        var team = row.Team == "away" ? away : home;
        var player = Family(row.Player);
        var who = string.IsNullOrEmpty(player) ? team : player;
        var shots = Count(window, row.Team ?? "", "shotontarget", "shotofftarget", "shotblocked", "goalkeeper_saved", "goal");
        var presses = Count(window, row.Team ?? "", "pressure", "tackle", "interception");

        return kind switch
        {
            "goal" when state == "siege" || shots >= 3 => (
                $"{who} finally breaks the door down — {team} had been camped in.",
                $"{who} converts after a {shots}-attempt spell. Pressure pays.",
                $"{team} turned sustained pressure into the scoreline — this is the payoff, not a smash-and-grab."),
            "goal" when presses >= 2 => (
                $"Won it high, punished them. {who} for {team}.",
                $"{who} scores off a high-regain sequence ({presses} pressures/duels in the window).",
                $"Territory flip after aggressive pressing — chaos created the chance, {who} took it."),
            "goal" => (
                $"{who} changes everything. {team} lead the story now.",
                $"{who} goal shifts match state. Prior window was {state}.",
                "Scoreboard moment: the match narrative pivots here regardless of the build."),
            "shotontarget" or "goalkeeper_saved" when shots >= 2 => (
                $"{who} again — {team} are forcing the issue.",
                $"{who} on target · {shots} attempts in the live window · state {state}.",
                $"Repeated attempts signal a siege forming — the next one may not be saved."),
            "shotontarget" or "goalkeeper_saved" => (
                $"{who} tests the keeper. Warning shot from {team}.",
                $"{who} on target · {shots} attempts · {state}.",
                $"First real ask of the keeper; territory is tipping toward {team}."),
            "shotblocked" => (
                $"Thrown body. {team}'s sight of goal gets snuffed out.",
                $"Block denies {who}. Defensive density holding under {state}.",
                $"A block keeps the score intact — but it also confirms {team} are getting shots away."),
            "shotofftarget" => (
                $"{who} leans back — {team} miss the moment.",
                $"{who} off target · window attempts {shots} · {state}.",
                shots >= 2 ? "Waste in a good spell — control without the cut." : "Half-chance gone; rhythm stays unsettled."),
            "card" => (
                $"{who} walks a tightrope now. {team} have to calm the duel.",
                $"Booking · {who}. Next foul risk elevates; state was {state}.",
                "Discipline check — one more mistake and the tactical plan collapses into damage control."),
            "tackle" or "interception" => (
                $"{who} steals it for {team} — sudden turn of the screw.",
                $"{kind} won by {who}. Regain under {state}.",
                state is "chaos" or "siege"
                    ? "A clean regain in a volatile spell often precedes the chance. Watch the next 20 seconds."
                    : $"Possession flip without a foul — {team} can build instead of boot."),
            "pressure" => (
                $"{team} squeeze. {who} leads the hunt.",
                $"Pressure event · {who} · {state}.",
                "Coordinated pressure is how control becomes chaos — or how a siege starts."),
            "corner" => (
                Count(window, row.Team ?? "", "corner") >= 2
                    ? $"Another corner — {team} won't go away."
                    : $"Corner. {team} load the box.",
                $"Set piece · {team} · {Count(window, row.Team ?? "", "corner")} corners in window.",
                "Dead-ball territory is where thin leads die and comebacks begin."),
            "periodscore" => (
                "Break. Time to breathe — and rewrite the plan.",
                "Period boundary · coaches answer the first spell.",
                "Half-time is where coaches answer the question the first 45 asked."),
            "match_ended" => (
                $"Full time. {home} {row.Text ?? ""}".Trim(),
                "FT · final state locked.",
                "The story is complete — now it's about which spells actually decided it."),
            "pass" when string.Equals(row.Difficulty, "hard", StringComparison.OrdinalIgnoreCase) || (row.Distance ?? 0) >= 28 => (
                $"{who} opens the pitch for {team}.",
                $"Progressive pass · {who} · {Math.Round(row.Distance ?? 0)}m · {row.Difficulty ?? "hard"}.",
                "A hard switch or line-break pass is often the first frame of a chance — not filler."),
            "pass" => (
                row.Text ?? $"{who} on the ball.",
                row.Text ?? $"Pass · {who}",
                null),
            "substitution" => (
                row.Text ?? "Fresh legs.",
                row.Text ?? "Substitution · tactical reset.",
                "Personnel change is a bet on the next spell — energy, matchup, or damage control."),
            "offside" => (
                row.Text ?? "Flag up.",
                row.Text ?? "Offside · attacking line depth check.",
                "The line is holding — or the runner mistimed a real chance."),
            _ => (row.Text ?? kind, row.Text ?? kind, null),
        };
    }
}
