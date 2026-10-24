using Touchline.Api.Models;

namespace Touchline.Api.Services;

public static class PitchUtil
{
    public const double AttackFrom = 60;
    public const double DangerFrom = 75;

    public static double Clamp(double? value)
    {
        if (value is null || double.IsNaN(value.Value) || double.IsInfinity(value.Value)) return 50;
        var n = value.Value;
        if (n <= 2) return 6;
        if (n >= 98) return 94;
        return Math.Max(6, Math.Min(94, n));
    }

    public static double? AttackDepth(string? team, double? x)
    {
        if (x is null || (team != "home" && team != "away")) return null;
        return team == "away" ? 100 - x.Value : x.Value;
    }

    public static string PossessionPhase(string? team, double x, double? fromX = null)
    {
        var depth = AttackDepth(team, x);
        if (depth is null) return "safe";
        if (fromX is not null)
        {
            var fromDepth = AttackDepth(team, fromX);
            if (fromDepth is not null && fromDepth.Value - depth.Value >= 4) return "safe";
        }
        if (depth >= DangerFrom) return "dangerous";
        if (depth >= AttackFrom) return "attack";
        return "safe";
    }

    public static string ClockOf(int? minute, int added = 0)
    {
        if (minute is null) return "";
        return added > 0 ? $"{minute}'+{added}" : $"{minute}'";
    }

    public static (int Minute, int Added, string Clock) SplitTime(double t)
    {
        var whole = Math.Max(0, (int)Math.Floor(t));
        var added = (int)Math.Round((t - whole) * 100);
        return (whole, added, ClockOf(whole, added));
    }

    public static double Lerp(double a, double b, double t) => a + (b - a) * t;

    public static double EaseInOut(double t) =>
        t < 0.5 ? 2 * t * t : 1 - Math.Pow(-2 * t + 2, 2) / 2;

    public static double Hash01(double n)
    {
        var x = Math.Sin(n * 12.9898) * 43758.5453;
        return x - Math.Floor(x);
    }

    public static double TimeKey(MatchEvent e)
    {
        var clock = e.Clock ?? "";
        var text = e.Text ?? "";
        if (e.Type == "periodstart" && (Contains(clock, "1st") || Contains(clock, "first") || Contains(text, "1st") || Contains(text, "first")))
            return 0;
        if (e.Type == "periodscore" && (Contains(clock, "1st") || Contains(clock, "first") || Contains(text, "1st") || Contains(text, "first")))
            return 45.55;
        if (e.Type == "periodstart" && (Contains(clock, "2nd") || Contains(clock, "second") || Contains(text, "2nd") || Contains(text, "second")))
            return 45.6;
        if (e.Type == "periodscore" && Contains(clock, "full"))
            return 200;
        if (e.Type == "match_ended") return 201;
        if (e.Minute is null) return 0;
        return e.Minute.Value + e.Added / 100.0;
    }

    static bool Contains(string hay, string needle) =>
        hay.Contains(needle, StringComparison.OrdinalIgnoreCase);
}
