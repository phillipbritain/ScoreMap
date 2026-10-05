namespace ScoreMap.Server.Venues;

/// <summary>Venue locator settings, under "Venues" in appsettings.json.</summary>
public sealed class VenueOptions
{
    /// <summary>File the venue lookups are saved to, relative to the content root.</summary>
    public string SavedLocationsPath { get; set; } = "data/venue-locations.json";
}
