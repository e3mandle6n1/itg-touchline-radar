namespace Touchline.Api.Models;

public sealed class Situation
{
    public int? Minute { get; set; }
    public int Added { get; set; }
    public string? Clock { get; set; }
    public string? Team { get; set; }
    public string Phase { get; set; } = "safe";
    public double X { get; set; }
    public double Y { get; set; }
    public string? Incident { get; set; }
    public string? Player { get; set; }
    public string? Text { get; set; }
    public string? Card { get; set; }
    public bool? Shootout { get; set; }
    public string? Period { get; set; }
    public string? Type { get; set; }
    public string? Outcome { get; set; }
    public double? Distance { get; set; }
    public string? Difficulty { get; set; }
    public double? Speed { get; set; }
    public string? State { get; set; }
    public string? Importance { get; set; }
    public string? Casual { get; set; }
    public string? Analyst { get; set; }
    public string? Why { get; set; }
    public string? MetricLabel { get; set; }
    public string? MetricDetail { get; set; }
}
