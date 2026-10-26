namespace Touchline.Api.Services;

public sealed class EventHubOptions
{
    public const string SectionName = "EventHub";
    public string Connection { get; set; } = "";
    public string Name { get; set; } = "matches";
    public string ConsumerGroup { get; set; } = "bridge";
    public int PublishIntervalMs { get; set; } = 240;
}
