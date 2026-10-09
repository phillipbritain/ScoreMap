namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A speed the scenario clock can run at (ADR-0009), by name: it runs <see cref="Times"/> times faster
/// than real time, and stands still at <see cref="Paused"/>.
/// </summary>
public sealed record Speed(string Name, int Times)
{
    public static readonly Speed Paused = new("Paused", 0);
    public static readonly Speed Normal = new("Normal", 1);
    public static readonly Speed Fast = new("Fast", 2);
    public static readonly Speed Faster = new("Faster", 8);

    /// <summary>The speeds to choose from, slowest first.</summary>
    public static readonly IReadOnlyList<Speed> All = [Paused, Normal, Fast, Faster];

    /// <summary>The speed named <paramref name="name"/>, in any case, if there is one.</summary>
    public static Speed? Named(string? name) => All.FirstOrDefault(speed => string.Equals(speed.Name, name, StringComparison.OrdinalIgnoreCase));

    /// <summary>The speeds as a message lists them: "Paused, Normal, …".</summary>
    public static string List => string.Join(", ", All.Select(speed => speed.Name));
}
