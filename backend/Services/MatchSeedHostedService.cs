namespace Touchline.Api.Services;

public sealed class MatchSeedHostedService(
    IMatchStore store,
    ILogger<MatchSeedHostedService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= 30; attempt++)
        {
            try
            {
                await store.SeedFromDiskAsync(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < 30)
            {
                logger.LogWarning(ex, "Azurite not ready for seed ({Attempt}/30)", attempt);
                await Task.Delay(2000, cancellationToken);
            }
            catch (Exception ex)
            {
                // Don't take the whole host down if seed never succeeds (e.g. Azurite API lag).
                logger.LogError(ex, "Match seed failed after {Attempts} attempts; catalog may be empty until /api/admin/seed", attempt);
                return;
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
