namespace Touchline.Api.Models;

public sealed class ScoreDto
{
    public int Home { get; set; }
    public int Away { get; set; }
    public string? Ht { get; set; }
    public string? Pens { get; set; }
}
