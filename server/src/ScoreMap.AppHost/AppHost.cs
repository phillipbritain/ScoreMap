// Local runs (ADR-0013): the server and the browser app (Vite), started with `aspire start`.
var builder = DistributedApplication.CreateBuilder(args);

var server = builder.AddProject<Projects.ScoreMap_Server>("server")
    .WithHttpHealthCheck("/health");

builder.AddViteApp("web", "../../../web")
    .WithReference(server)
    .WaitFor(server);

builder.Build().Run();
