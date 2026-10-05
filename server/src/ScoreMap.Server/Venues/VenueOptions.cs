namespace ScoreMap.Server.Venues;

/// <summary>Venue locator settings, under "Venues" in appsettings.json.</summary>
public sealed class VenueOptions
{
    /// <summary>File the venue lookups are saved to, relative to the content root.</summary>
    public string SavedLocationsPath { get; set; } = "data/venue-locations.json";

    /// <summary>
    /// The owner's corrections file, relative to the content root: venue names mapped to the
    /// position their pin should use. Overrides any lookup; re-read whenever it changes.
    /// </summary>
    public string CorrectionsPath { get; set; } = "venue-corrections.json";
}
