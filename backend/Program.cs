using System.Text.Json.Serialization;
using Touchline.Api.Endpoints;
using Touchline.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<EventHubOptions>(builder.Configuration.GetSection(EventHubOptions.SectionName));
builder.Services.PostConfigure<EventHubOptions>(options =>
{
    var conn = builder.Configuration["EVENT_HUB_CONNECTION"];
    var name = builder.Configuration["EVENT_HUB_NAME"];
    var group = builder.Configuration["EVENT_HUB_CONSUMER_GROUP"];
    var interval = builder.Configuration["PUBLISH_INTERVAL_MS"];
    if (!string.IsNullOrWhiteSpace(conn)) options.Connection = conn;
    if (!string.IsNullOrWhiteSpace(name)) options.Name = name;
    if (!string.IsNullOrWhiteSpace(group)) options.ConsumerGroup = group;
    if (int.TryParse(interval, out var ms)) options.PublishIntervalMs = ms;
});

builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));
builder.Services.PostConfigure<BlobStorageOptions>(options =>
{
    var conn = builder.Configuration["AZURE_STORAGE_CONNECTION"]
        ?? builder.Configuration["AzureWebJobsStorage"];
    var container = builder.Configuration["BLOB_CONTAINER"];
    var seed = builder.Configuration["MATCH_SEED_PATH"];
    if (!string.IsNullOrWhiteSpace(conn)) options.Connection = conn;
    if (!string.IsNullOrWhiteSpace(container)) options.Container = container;
    if (!string.IsNullOrWhiteSpace(seed)) options.SeedPath = seed;
});

builder.Services.AddSingleton<HubFeedStore>();
builder.Services.AddSingleton<IMatchStore, BlobMatchStore>();
builder.Services.AddSingleton<IEventHubPublisher, EventHubPublisher>();
builder.Services.AddHostedService<HubConsumerService>();
builder.Services.AddHostedService<MatchSeedHostedService>();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

app.MapMatchEndpoints();
app.MapLiveEndpoints();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
