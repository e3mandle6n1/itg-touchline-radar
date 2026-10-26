using Microsoft.Extensions.Options;
using Touchline.Api.Models;
using Touchline.Api.Services;

namespace Touchline.Api.Endpoints;

public static class MatchEndpoints
{
    public static IEndpointRouteBuilder MapMatchEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api");

        group.MapGet("/catalog", async (IMatchStore store, CancellationToken ct) =>
            Results.Ok(await store.GetCatalogAsync(ct)));

        group.MapGet("/matches/{matchId}", async (string matchId, IMatchStore store, CancellationToken ct) =>
        {
            var match = await store.GetEnrichedMatchAsync(matchId, ct);
            return match is null
                ? Results.NotFound(new { error = $"Unknown match: {matchId}" })
                : Results.Ok(match);
        });

        group.MapPost("/publish/{matchId}", async (
            string matchId,
            PublishRequest? body,
            IMatchStore store,
            IEventHubPublisher publisher,
            IOptions<EventHubOptions> hubOptions,
            ILoggerFactory loggers,
            CancellationToken ct) =>
        {
            var match = await store.GetEnrichedMatchAsync(matchId, ct);
            if (match is null)
                return Results.NotFound(new { error = $"Unknown match: {matchId}" });

            var interval = (int)(body?.Interval ?? hubOptions.Value.PublishIntervalMs);
            if (interval < 0)
                return Results.BadRequest(new { error = "interval must be a non-negative number of milliseconds" });

            // Always (re)start — a stuck mid-match publish left browsers on
            // "Loading…" after SSE catch-up choked on the backlog.
            var log = loggers.CreateLogger("Publish");
            var status = publisher.IsPublishing(matchId) ? "restarting" : "publishing";
            _ = PublishInBackground(publisher, matchId, match, interval, log);

            return Results.Accepted(value: new PublishResponse
            {
                MatchId = matchId,
                SituationCount = match.Situations.Count,
                Status = status,
            });
        });

        group.MapPost("/admin/seed", async (IMatchStore store, CancellationToken ct) =>
        {
            await store.SeedFromDiskAsync(ct);
            return Results.Ok(new { status = "seeded" });
        });

        return app;
    }

    static async Task PublishInBackground(
        IEventHubPublisher publisher,
        string matchId,
        MatchDto match,
        int interval,
        ILogger log)
    {
        try
        {
            await publisher.PublishAsync(matchId, match, interval);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "publish {MatchId} failed", matchId);
        }
    }
}
