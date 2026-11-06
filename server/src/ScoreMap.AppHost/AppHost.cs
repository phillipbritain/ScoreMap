// Local runs (ADR-0013): the server and the browser app (Vite), started with `aspire start`.
var builder = DistributedApplication.CreateBuilder(args);

var server = builder.AddProject<Projects.ScoreMap_Server>("server")
    .WithHttpHealthCheck("/health");

// The app also answers other devices on the network, such as a phone, at this machine's address,
// unless OpenToNetwork=false is in the environment. Vite passes /api and /hubs on to the server,
// so only the app's endpoint needs opening.
var openToNetwork = !string.Equals(builder.Configuration["OpenToNetwork"], "false", StringComparison.OrdinalIgnoreCase);

// On Vite's usual port in a plain run, so the app is always at the same address (an isolated run's are random).
builder.AddViteApp("web", "../../../web")
    .WithEndpoint("http", endpoint =>
    {
        endpoint.Port = 5173;
        if (openToNetwork)
            endpoint.TargetHost = "0.0.0.0";
    })
    .WithReference(server)
    .WaitFor(server);

builder.Build().Run();
