using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace Touchline.Api.Services;

public sealed class FeedState
{
    public JsonElement? Fixture { get; set; }
    public int SituationCount { get; set; }
    public List<JsonElement> Situations { get; } = [];
    public HashSet<int> Seen { get; } = [];
}

public sealed class HubFeedStore
{
    readonly ConcurrentDictionary<string, FeedState> _feeds = new();
    readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, ChannelWriter<string>>> _clients = new();

    public FeedState? Get(string matchId) =>
        _feeds.TryGetValue(matchId, out var feed) ? feed : null;

    public bool Apply(JsonElement message)
    {
        if (!message.TryGetProperty("matchId", out var idProp)) return false;
        var matchId = idProp.GetString();
        if (string.IsNullOrEmpty(matchId)) return false;
        if (!message.TryGetProperty("kind", out var kindProp)) return false;
        var kind = kindProp.GetString();

        var feed = _feeds.GetOrAdd(matchId, _ => new FeedState());
        lock (feed)
        {
            if (kind == "fixture")
            {
                // New fixture = new publish run. Drop prior seqs so a republish can stream again.
                feed.Situations.Clear();
                feed.Seen.Clear();
                feed.Seen.Add(0);
                if (message.TryGetProperty("fixture", out var fixture))
                    feed.Fixture = fixture.Clone();
                if (message.TryGetProperty("situationCount", out var count))
                    feed.SituationCount = count.GetInt32();
                else
                    feed.SituationCount = 0;
                Broadcast(matchId, "fixture", message);
                return true;
            }

            if (kind != "situation") return false;
            if (!message.TryGetProperty("seq", out var seqProp)) return false;
            var seq = seqProp.GetInt32();
            if (!feed.Seen.Add(seq)) return false;
            if (message.TryGetProperty("situation", out var situation))
                feed.Situations.Add(situation.Clone());
            Broadcast(matchId, "situation", message);
            return true;
        }
    }

    public IDisposable Subscribe(string matchId, ChannelWriter<string> writer)
    {
        var id = Guid.NewGuid();
        var bag = _clients.GetOrAdd(matchId, _ => new ConcurrentDictionary<Guid, ChannelWriter<string>>());
        bag[id] = writer;

        var feed = Get(matchId);
        if (feed?.Fixture is { } fixture)
        {
            int situationCount;
            lock (feed) situationCount = feed.SituationCount;

            // Fixture only on catch-up. Replaying 1k+ situations through the Vite
            // proxy kills browser EventSource before React can paint. Live ticks
            // arrive via Broadcast after publish (re)starts.
            var fixtureMsg = JsonSerializer.Serialize(new
            {
                matchId,
                seq = 0,
                kind = "fixture",
                situationCount,
                fixture,
            });
            writer.TryWrite(Sse("fixture", fixtureMsg));
        }

        return new Subscription(() =>
        {
            if (_clients.TryGetValue(matchId, out var current))
            {
                current.TryRemove(id, out _);
                if (current.IsEmpty) _clients.TryRemove(matchId, out _);
            }
        });
    }

    void Broadcast(string matchId, string eventName, JsonElement message)
    {
        if (!_clients.TryGetValue(matchId, out var bag)) return;
        var payload = Sse(eventName, message.GetRawText());
        foreach (var writer in bag.Values)
            writer.TryWrite(payload);
    }

    static string Sse(string eventName, string data) =>
        $"event: {eventName}\ndata: {data}\n\n";

    sealed class Subscription(Action dispose) : IDisposable
    {
        public void Dispose() => dispose();
    }
}
