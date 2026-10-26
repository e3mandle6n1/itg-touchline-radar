namespace Touchline.Api.Models;

public sealed class CatalogResponse
{
    public string DefaultId { get; set; } = "01-northbridge";
    public List<CatalogEntry> Matches { get; set; } = [];
}
