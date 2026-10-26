using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using Azure.Messaging.EventHubs;
using Azure.Messaging.EventHubs.Producer;
using Microsoft.Extensions.Options;
using Touchline.Api.Models;

namespace Touchline.Api.Services;

public interface IEventHubPublisher
{
    bool IsPublishing(string matchId);
    Task PublishAsync(string matchId, MatchDto match, int intervalMs, CancellationToken cancellationToken = default);
}

public sealed class EventHubPublisher(
    IOptions<EventHubOptions> options,
    ILogger<EventHubPublisher> logger) : IEventHubPublisher
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    readonly ConcurrentDictionary<string, CancellationTokenSource> _runs = new();

    public bool IsPublishing(string matchId) =>
        _runs.TryGetValue(matchId, out var cts) && !cts.IsCancellationRequested;

    public async Task PublishAsync(string matchId, MatchDto match, int intervalMs, CancellationToken cancellationToken = default)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

        // Cancel any in-flight run, but do NOT dispose it here — that task's
        // finally block owns dispose. Disposing early caused ObjectDisposedException
        // under React Strict Mode double-publish.
        if (_runs.TryRemove(matchId, out var prior))
        {
            try { prior.Cancel(); }
            catch (ObjectDisposedException) { }
        }
        _runs[matchId] = cts;

        try
        {
            var opts = options.Value;
            if (string.IsNullOrWhiteSpace(opts.Connection) || string.IsNullOrWhiteSpace(opts.Name))
                throw new InvalidOperationException("EVENT_HUB_CONNECTION / EVENT_HUB_NAME are not set.");

            await using var producer = new EventHubProducerClient(opts.Connection, opts.Name);
            await WaitForHubAsync(producer, cts.Token);

            var messages = BuildMessages(match, matchId);
            for (var i = 0; i < messages.Count; i++)
            {
                cts.Token.ThrowIfCancellationRequested();
                using var batch = await producer.CreateBatchAsync(
                    new CreateBatchOptions { PartitionKey = matchId },
                    cts.Token);
                if (!batch.TryAdd(new EventData(messages[i]) { ContentType = "application/json" }))
                    throw new InvalidOperationException($"message {i} did not fit in a batch");
                await producer.SendAsync(batch, cts.Token);

                if (i > 0 && intervalMs > 0)
                    await Task.Delay(intervalMs, cts.Token);
            }

            logger.LogInformation("Published {MatchId}: {Count} messages", matchId, messages.Count);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("Publish {MatchId} cancelled", matchId);
        }
        catch (ObjectDisposedException)
        {
            logger.LogInformation("Publish {MatchId} cancelled (disposed token)", matchId);
        }
        finally
        {
            if (_runs.TryGetValue(matchId, out var current) && ReferenceEquals(current, cts))
                _runs.TryRemove(matchId, out _);
            try { cts.Dispose(); }
            catch (ObjectDisposedException) { }
        }
    }

    static List<string> BuildMessages(MatchDto match, string matchId)
    {
        var situations = match.Situations ?? [];
        var fixture = JsonSerializer.Deserialize<MatchDto>(JsonSerializer.Serialize(match, JsonOptions), JsonOptions)!;
        fixture.Situations = [];
        fixture.Events = [];

        var list = new List<string>
        {
            JsonSerializer.Serialize(new
            {
                matchId,
                seq = 0,
                kind = "fixture",
                situationCount = situations.Count,
                fixture,
            }, JsonOptions),
        };

        for (var i = 0; i < situations.Count; i++)
        {
            list.Add(JsonSerializer.Serialize(new
            {
                matchId,
                seq = i + 1,
                kind = "situation",
                situation = situations[i],
            }, JsonOptions));
        }

        return list;
    }

    async Task WaitForHubAsync(EventHubProducerClient producer, CancellationToken cancellationToken)
    {
        Exception? last = null;
        for (var attempt = 1; attempt <= 30; attempt++)
        {
            try
            {
                await producer.GetEventHubPropertiesAsync(cancellationToken);
                return;
            }
            catch (Exception ex)
            {
                last = ex;
                logger.LogWarning(ex, "hub not ready ({Attempt}/30)", attempt);
                if (attempt == 30) break;
                await Task.Delay(2000, cancellationToken);
            }
        }
        throw last ?? new InvalidOperationException("Event Hub not ready");
    }
}
