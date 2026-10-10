using System.ComponentModel;
using System.Globalization;

namespace ScoreMap.Server.Games;

/// <summary>
/// A sport ScoreMap knows how to show (see GLOSSARY.md). Configured by its display name, e.g.
/// "Football"; any other name fails configuration binding, so a typo stops the server at
/// startup instead of quietly losing the sport's clock line.
/// </summary>
[TypeConverter(typeof(SportConverter))]
public enum Sport
{
    Football,
    Basketball,
    Baseball,
    Hockey,
    Soccer,
}

/// <summary>
/// How a sport's games usually go, which a league can override (see <see cref="League"/>): how many
/// periods make up a game before overtime, and how many minutes each lasts on the game clock (null in a
/// sport without one).
/// </summary>
public sealed record SportUsual(int RegulationPeriods, int? PeriodMinutes);

public static class Sports
{
    /// <summary>Each sport's name, which browsers show and configuration uses, and how its games usually go.</summary>
    private static readonly Dictionary<Sport, (string Name, SportUsual Usual)> All = new()
    {
        [Sport.Football] = ("Football", new(RegulationPeriods: 4, PeriodMinutes: 15)),
        [Sport.Basketball] = ("Basketball", new(RegulationPeriods: 4, PeriodMinutes: 12)),
        [Sport.Baseball] = ("Baseball", new(RegulationPeriods: 9, PeriodMinutes: null)),
        [Sport.Hockey] = ("Hockey", new(RegulationPeriods: 3, PeriodMinutes: 20)),
        [Sport.Soccer] = ("Soccer", new(RegulationPeriods: 2, PeriodMinutes: 45)),
    };

    private static IEnumerable<string> Names => All.Values.Select(sport => sport.Name);

    /// <summary>The name browsers show and configuration uses, e.g. "Football".</summary>
    public static string DisplayName(this Sport sport) => All[sport].Name;

    /// <summary>How the sport's games usually go, unless a league says otherwise.</summary>
    public static SportUsual Usual(this Sport sport) => All[sport].Usual;

    /// <summary>The sport with this display name (ignoring case), or an error naming the known ones.</summary>
    public static Sport Parse(string name) =>
        All.FirstOrDefault(s => string.Equals(s.Value.Name, name.Trim(), StringComparison.OrdinalIgnoreCase)) is { Value.Name: not null } found
            ? found.Key
            : throw new FormatException(
                $"Unknown sport \"{name}\"; expected one of: {string.Join(", ", Names.Select(n => $"\"{n}\""))}.");
}

/// <summary>Lets configuration binding read a <see cref="Sport"/> from its display name.</summary>
public sealed class SportConverter : TypeConverter
{
    public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType) =>
        sourceType == typeof(string) || base.CanConvertFrom(context, sourceType);

    public override object? ConvertFrom(ITypeDescriptorContext? context, CultureInfo? culture, object value) =>
        value is string name ? Sports.Parse(name) : base.ConvertFrom(context, culture, value);
}
