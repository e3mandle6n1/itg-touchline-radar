namespace Touchline.Api.Models;

public sealed class InfoDto
{
    public string Weather { get; set; } = "Good";
    public string Pitch { get; set; } = "Good";
    public string Distance { get; set; } = "180 km";
    public string Capacity { get; set; } = "42,000";
    public string Referee { get; set; } = "Cole, Adrian";
    public string? Venue { get; set; }
    public string? City { get; set; }
}
