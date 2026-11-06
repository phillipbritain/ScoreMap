// Local runs (ADR-0013): the server and the browser app (Vite), started with `aspire start`.
var builder = DistributedApplication.CreateBuilder(args);

var server = builder.AddProject<Projects.ScoreMap_Server>("server")
    .WithHttpHealthCheck("/health");

// On Vite's usual port in a plain run, so the app is always at the same address (an isolated run's are random).
builder.AddViteApp("web", "../../../web")
    .WithEndpoint("http", endpoint => endpoint.Port = 5173)
    .WithReference(server)
    .WaitFor(server);

builder.Build().Run();
