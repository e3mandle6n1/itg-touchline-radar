namespace Touchline.Api.Models;

public sealed class LineupSide
{
    public string Formation { get; set; } = "4-3-3";
    public string Manager { get; set; } = "";
    public List<PlayerDto> Xi { get; set; } = [];
    public List<PlayerDto> Subs { get; set; } = [];
    public List<object> Swaps { get; set; } = [];
}
