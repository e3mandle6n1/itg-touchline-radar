using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;
using Touchline.Api.Models;

namespace Touchline.Api.Services;

public interface IMatchStore
{
    Task<CatalogResponse> GetCatalogAsync(CancellationToken cancellationToken = default);
    Task<MatchDto?> GetEnrichedMatchAsync(string matchId, CancellationToken cancellationToken = default);
    Task SeedFromDiskAsync(CancellationToken cancellationToken = default);
}

public sealed class BlobMatchStore(
    IOptions<BlobStorageOptions> options,
    ILogger<BlobMatchStore> logger) : IMatchStore
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    BlobContainerClient Container()
    {
        var opts = options.Value;
        if (string.IsNullOrWhiteSpace(opts.Connection))
            throw new InvalidOperationException("AZURE_STORAGE_CONNECTION is not set.");
        return new BlobServiceClient(opts.Connection).GetBlobContainerClient(opts.Container);
    }

    public async Task SeedFromDiskAsync(CancellationToken cancellationToken = default)
    {
        var seedPath = options.Value.SeedPath;
        if (string.IsNullOrWhiteSpace(seedPath) || !Directory.Exists(seedPath))
        {
            logger.LogWarning("Match seed path missing or empty: {Path}", seedPath);
            return;
        }

        var container = Container();
        await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: cancellationToken);

        foreach (var file in Directory.GetFiles(seedPath, "*.json"))
        {
            var name = Path.GetFileName(file);
            await using var stream = File.OpenRead(file);
            await container.GetBlobClient(name).UploadAsync(stream, overwrite: true, cancellationToken);
            logger.LogInformation("Seeded blob {Name}", name);
        }
    }

    public async Task<CatalogResponse> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        var blob = Container().GetBlobClient("index.json");
        if (!await blob.ExistsAsync(cancellationToken))
            return new CatalogResponse { Matches = [] };

        var download = await blob.DownloadContentAsync(cancellationToken);
        return download.Value.Content.ToObjectFromJson<CatalogResponse>(JsonOptions)
            ?? new CatalogResponse();
    }

    public async Task<MatchDto?> GetEnrichedMatchAsync(string matchId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(matchId) || matchId.Contains('/') || matchId.Contains('\\') || matchId.Contains(".."))
            return null;

        var blob = Container().GetBlobClient($"{matchId}.json");
        if (!await blob.ExistsAsync(cancellationToken))
            return null;

        var download = await blob.DownloadContentAsync(cancellationToken);
        var lean = download.Value.Content.ToObjectFromJson<MatchDto>(JsonOptions);
        if (lean is null) return null;

        lean.Situations = [];
        return MatchEnricher.Enrich(lean);
    }
}
