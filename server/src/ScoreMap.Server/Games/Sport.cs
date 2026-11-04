using System.ComponentModel;
using System.Globalization;
using ScoreMap.Server.Sports;

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
    Cricket,

    /// <summary>Rugby union (not rugby league or sevens).</summary>
    Rugby,
    Tennis,
    Racing,
    Golf,

    /// <summary>Mixed martial arts, configured and shown as "MMA".</summary>
    Mma,
}

/// <summary>
/// How a sport's games usually go, which a league can override (see <see cref="League"/>): how many
/// periods make up a game before overtime (innings, in cricket; sets, in tennis), and how many minutes each lasts on the
/// game clock (null in a sport without one).
/// </summary>
public sealed record SportUsual(int RegulationPeriods, int? PeriodMinutes);

public static class Sports
{
    private static IEnumerable<string> Names => Enum.GetValues<Sport>().Select(sport => sport.DisplayName());

    /// <summary>The name browsers show and configuration uses, e.g. "Football".</summary>
    public static string DisplayName(this Sport sport) => SportRules.For(sport).Name;

    /// <summary>How the sport's games usually go, unless a league says otherwise.</summary>
    public static SportUsual Usual(this Sport sport) => SportRules.For(sport).Usual;

    /// <summary>The sport with this display name (ignoring case), or an error naming the known ones.</summary>
    public static Sport Parse(string name) =>
        Enum.GetValues<Sport>().Where(sport => string.Equals(sport.DisplayName(), name.Trim(), StringComparison.OrdinalIgnoreCase))
            .Select(sport => (Sport?)sport).FirstOrDefault() is { } found
            ? found
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
