namespace Touchline.Api.Models;

public sealed class MatchEvent
{
    public string Type { get; set; } = "";
    public string? Team { get; set; }
    public int? Minute { get; set; }
    public int Added { get; set; }
    public string? Clock { get; set; }
    public ScoreDto? Score { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
    public string? Player { get; set; }
    public string? Text { get; set; }
    public string? Card { get; set; }
    public bool? Shootout { get; set; }
    public string? Period { get; set; }
    public string? Outcome { get; set; }
    public double? Distance { get; set; }
    public string? Difficulty { get; set; }
    public double? Speed { get; set; }
}
