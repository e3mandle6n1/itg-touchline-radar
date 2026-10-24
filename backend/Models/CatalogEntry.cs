namespace Touchline.Api.Models;

public sealed class CatalogEntry
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public List<string> Tags { get; set; } = [];
}
