using System.Threading.Channels;
using Touchline.Api.Services;

namespace Touchline.Api.Endpoints;

public static class LiveEndpoints
{
    public static IEndpointRouteBuilder MapLiveEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/live/{matchId}", async (
            string matchId,
            HttpContext http,
            HubFeedStore store,
            CancellationToken cancellationToken) =>
        {
            http.Response.Headers.ContentType = "text/event-stream";
            http.Response.Headers.CacheControl = "no-cache";
            http.Response.Headers.Connection = "keep-alive";

            var channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions
            {
                SingleReader = true,
                SingleWriter = false,
            });

            using var sub = store.Subscribe(matchId, channel.Writer);
            using var pingCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var pingTask = Task.Run(async () =>
            {
                using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
                try
                {
                    while (await timer.WaitForNextTickAsync(pingCts.Token))
                        channel.Writer.TryWrite(": ping\n\n");
                }
                catch (OperationCanceledException) { }
            }, pingCts.Token);

            try
            {
                await foreach (var chunk in channel.Reader.ReadAllAsync(cancellationToken))
                {
                    await http.Response.WriteAsync(chunk, cancellationToken);
                    await http.Response.Body.FlushAsync(cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // client disconnected
            }
            finally
            {
                pingCts.Cancel();
                channel.Writer.TryComplete();
                try { await pingTask; }
                catch (OperationCanceledException) { }
            }
        });

        return app;
    }
}
