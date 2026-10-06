using System.ComponentModel;
using System.Globalization;

namespace ScoreMap.Server.Games;

/// <summary>
/// A sport ScoreMap knows how to show (see GLOSSARY.md). Configured by its display name, e.g.
/// "American football"; any other name fails configuration binding, so a typo stops the server at
/// startup instead of quietly losing the sport's clock line.
/// </summary>
[TypeConverter(typeof(SportConverter))]
public enum Sport
{
    AmericanFootball,
    Basketball,
    Baseball,
    Hockey,
    Soccer,
}

public static class SportNames
{
    private static readonly Dictionary<Sport, string> Names = new()
    {
        [Sport.AmericanFootball] = "American football",
        [Sport.Basketball] = "Basketball",
        [Sport.Baseball] = "Baseball",
        [Sport.Hockey] = "Hockey",
        [Sport.Soccer] = "Soccer",
    };

    /// <summary>The name browsers show and configuration uses, e.g. "American football".</summary>
    public static string DisplayName(this Sport sport) => Names[sport];

    /// <summary>The sport with this display name (ignoring case), or an error naming the known ones.</summary>
    public static Sport Parse(string name) =>
        Names.FirstOrDefault(n => string.Equals(n.Value, name.Trim(), StringComparison.OrdinalIgnoreCase)) is { Value: not null } found
            ? found.Key
            : throw new FormatException(
                $"Unknown sport \"{name}\"; expected one of: {string.Join(", ", Names.Values.Select(v => $"\"{v}\""))}.");
}

/// <summary>Lets configuration binding read a <see cref="Sport"/> from its display name.</summary>
public sealed class SportConverter : TypeConverter
{
    public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType) =>
        sourceType == typeof(string) || base.CanConvertFrom(context, sourceType);

    public override object? ConvertFrom(ITypeDescriptorContext? context, CultureInfo? culture, object value) =>
        value is string name ? SportNames.Parse(name) : base.ConvertFrom(context, culture, value);
}
