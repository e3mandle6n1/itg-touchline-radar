namespace Touchline.Api.Models;

public sealed class PublishResponse
{
    public string MatchId { get; set; } = "";
    public int SituationCount { get; set; }
    public string Status { get; set; } = "publishing";
}
