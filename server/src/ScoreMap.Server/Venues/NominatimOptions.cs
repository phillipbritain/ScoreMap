namespace ScoreMap.Server.Venues;

/// <summary>OpenStreetMap Nominatim settings, under "Nominatim" in appsettings.json.</summary>
public sealed class NominatimOptions
{
    /// <summary>The service to query; switchable without a code change, as the usage policy asks.</summary>
    public Uri BaseUrl { get; set; } = new("https://nominatim.openstreetmap.org/");

    /// <summary>Shortest gap between two requests. The usage policy allows at most one per second.</summary>
    public TimeSpan MinRequestInterval { get; set; } = TimeSpan.FromSeconds(1.5);
}
