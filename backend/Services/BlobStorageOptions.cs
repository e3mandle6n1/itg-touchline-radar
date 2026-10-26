namespace Touchline.Api.Services;

public sealed class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";
    public string Connection { get; set; } = "";
    public string Container { get; set; } = "matches";
    public string SeedPath { get; set; } = "/seed";
}
