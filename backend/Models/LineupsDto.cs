namespace Touchline.Api.Models;

public sealed class LineupsDto
{
    public LineupSide Home { get; set; } = new();
    public LineupSide Away { get; set; } = new();
}
