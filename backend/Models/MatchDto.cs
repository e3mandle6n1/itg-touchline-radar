namespace Touchline.Api.Models;

public sealed class MatchDto
{
    public long Id { get; set; }
    public string Competition { get; set; } = "";
    public string Status { get; set; } = "Ended";
    public TeamDto Home { get; set; } = new();
    public TeamDto Away { get; set; } = new();
    public AveragesDto Averages { get; set; } = new();
    public ScoreDto Score { get; set; } = new();
    public InfoDto Info { get; set; } = new();
    public List<string> Marks { get; set; } = [];
    public List<MomentumDto> Momentum { get; set; } = [];
    public List<object> Stats { get; set; } = [];
    public FormDto Form { get; set; } = new();
    public List<object> Standings { get; set; } = [];
    public LineupsDto Lineups { get; set; } = new();
    public List<MatchEvent> Events { get; set; } = [];
    public List<Situation> Situations { get; set; } = [];
}
