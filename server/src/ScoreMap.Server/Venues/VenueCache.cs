using System.Text.Json;

namespace ScoreMap.Server.Venues;

/// <summary>Recovery for disposable runtime caches only; checked-in venue data stays strict.</summary>
internal static class VenueCache
{
    public static T? Read<T>(string path, JsonSerializerOptions json, ILogger logger)
    {
        try
        {
            using var file = File.OpenRead(path);
            return JsonSerializer.Deserialize<T>(file, json);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Recover(path, ex, logger);
            return default;
        }
    }

    public static async Task<T?> ReadAsync<T>(string path, JsonSerializerOptions json, ILogger logger,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            await using var file = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<T>(file, json, cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested
            && ex is IOException or UnauthorizedAccessException or JsonException)
        {
            Recover(path, ex, logger);
            return default;
        }
    }

    /// <summary>A failed atomic save leaves the caller's in-memory answer usable.</summary>
    public static async Task SaveAsync<T>(string path, T saved, JsonSerializerOptions json, ILogger logger,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var temp = path + ".tmp";
            await using (var file = File.Create(temp))
                await JsonSerializer.SerializeAsync(file, saved, json, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            File.Move(temp, path, overwrite: true);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested
            && ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not save venue cache {Path}; keeping the answers in memory", path);
        }
    }

    private static void Recover(string path, Exception exception, ILogger logger)
    {
        // A cache that hasn't been created yet is normal.
        if (exception is FileNotFoundException or DirectoryNotFoundException)
            return;

        logger.LogWarning(exception, "Could not read venue cache {Path}; continuing with an empty cache", path);
        if (exception is not JsonException)
            return;

        var quarantine = path + $".corrupt-{Guid.NewGuid():N}";
        try
        {
            File.Move(path, quarantine);
            logger.LogInformation("Moved malformed venue cache {Path} to {Quarantine}", path, quarantine);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Could not quarantine malformed venue cache {Path}", path);
        }
    }
}
