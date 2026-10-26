namespace Touchline.Api.Models;

public sealed class MomentumDto
{
    public int Minute { get; set; }
    public string Type { get; set; } = "";
    public string Team { get; set; } = "";
    public string? Card { get; set; }
}
