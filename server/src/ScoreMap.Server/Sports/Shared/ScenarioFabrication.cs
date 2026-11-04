using System.Globalization;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

internal static class ScenarioFabrication
{
    private static readonly string[] FirstNames =
    [
        "Alex", "Jordan", "Marcus", "Tyler", "Chris", "Jamal", "Luis", "Mateo", "Ryan", "Kevin", "Andre", "Sam",
        "Nico", "Darius", "Owen", "Ethan", "Leo", "Isaac", "Theo", "Miles", "Caleb", "Hugo", "Felix", "Jonah",
    ];

    private static readonly string[] LastNames =
    [
        "Carter", "Reyes", "Okafor", "Lindqvist", "Brooks", "Nakamura", "Silva", "Dubois", "Kowalski", "Hayes",
        "Mensah", "Fischer", "Moreno", "Walsh", "Petrov", "Bennett", "Adeyemi", "Larsen", "Costa", "Murphy",
        "Novak", "Ortiz", "Grant", "Haddad",
    ];

    internal static string Player(Random random) => $"{Pick(random, FirstNames)} {Pick(random, LastNames)}";

    internal static string Pick(Random random, params string[] choices) => choices[random.Next(choices.Length)];

    internal static Random Seeded(string a, string b) => new(Scenario.StableSeed($"{a}\u0001{b}"));

    internal static string Number(double value) => value.ToString(CultureInfo.InvariantCulture);

    internal static string Ordinal(int n) => n switch { 1 => "1st", 2 => "2nd", 3 => "3rd", _ => $"{n}th" };
}
