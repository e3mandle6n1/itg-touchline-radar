using System.Text;
using System.Text.Json;
using Azure.Messaging.EventHubs;
using Azure.Messaging.EventHubs.Consumer;
using Microsoft.Extensions.Options;

namespace Touchline.Api.Services;

public sealed class HubConsumerService(
    IOptions<EventHubOptions> options,
    HubFeedStore store,
    ILogger<HubConsumerService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var opts = options.Value;
        if (string.IsNullOrWhiteSpace(opts.Connection)
            || string.IsNullOrWhiteSpace(opts.Name)
            || string.IsNullOrWhiteSpace(opts.ConsumerGroup))
        {
            logger.LogWarning("Event Hub consumer not configured; /live will stay idle.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var consumer = new EventHubConsumerClient(
                    opts.ConsumerGroup,
                    opts.Connection,
                    opts.Name);

                await WaitForHubAsync(consumer, stoppingToken);
                logger.LogInformation("Hub consumer listening on {Hub}", opts.Name);

                await foreach (var item in consumer.ReadEventsAsync(
                                   startReadingAtEarliestEvent: true,
                                   cancellationToken: stoppingToken))
                {
                    if (item.Data?.EventBody is null) continue;
                    try
                    {
                        var json = Encoding.UTF8.GetString(item.Data.EventBody.ToArray());
                        using var doc = JsonDocument.Parse(json);
                        store.Apply(doc.RootElement.Clone());
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Skipping bad hub message");
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Hub consumer failed; retrying in 2s");
                try { await Task.Delay(2000, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }
        }
    }

    static async Task WaitForHubAsync(EventHubConsumerClient consumer, CancellationToken cancellationToken)
    {
        Exception? last = null;
        for (var attempt = 1; attempt <= 30; attempt++)
        {
            try
            {
                await consumer.GetEventHubPropertiesAsync(cancellationToken);
                return;
            }
            catch (Exception ex)
            {
                last = ex;
                Console.Error.WriteLine($"hub not ready ({attempt}): {ex.Message}");
                if (attempt == 30) break;
                await Task.Delay(2000, cancellationToken);
            }
        }
        throw last ?? new InvalidOperationException("Event Hub not ready");
    }
}
