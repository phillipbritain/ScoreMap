namespace ScoreMap.Server.Venues;

/// <summary>Venue locator settings, under "Venues" in appsettings.json.</summary>
public sealed class VenueOptions
{
    /// <summary>
    /// File the venue lookups are saved to. A relative path is relative to the content root, or
    /// to HOME when running on Azure App Service (so by default /home/data/venue-locations.json).
    /// </summary>
    public string SavedLocationsPath { get; set; } = "data/venue-locations.json";

    /// <summary>
    /// File the venue photos found are saved to. Relative paths resolve as for
    /// <see cref="SavedLocationsPath"/> (on App Service, by default /home/data/venue-photos.json).
    /// </summary>
    public string SavedPhotosPath { get; set; } = "data/venue-photos.json";

    /// <summary>
    /// The owner's corrections file, relative to the content root: venue names mapped to the
    /// position their pin should use. Overrides any lookup; re-read whenever it changes.
    /// </summary>
    public string CorrectionsPath { get; set; } = "venue-corrections.json";
}
