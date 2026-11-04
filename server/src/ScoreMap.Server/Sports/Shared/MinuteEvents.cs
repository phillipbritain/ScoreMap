using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports.Shared;

internal static class MinuteEvents
{

    internal static void Cards(List<ProviderKeyEvent> events, ProviderGame game, int from, int minute, double chance, double redChance)
    {
        var sides = game.Sides();
        for (var at = from + 1; at <= minute; at++)
        {
            var random = Seeded(game.Id, $"card {at}");
            var roll = random.NextDouble();
            if (roll < chance)
                events.Add(new ProviderKeyEvent(roll < redChance ? KeyEventKind.RedCard : KeyEventKind.YellowCard,
                    (random.Next(2) == 0 ? sides.Home : sides.Away).Abbreviation, Player(random), $"{at}'"));
        }
    }

    internal static (ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents) InOrder(
        List<ProviderKeyEvent> events, Func<KeyEventKind, string> name)
    {
        var ordered = events.OrderBy(e => Minute(e.Clock)).ToList();
        var last = ordered.LastOrDefault(e => e.Kind is not (KeyEventKind.YellowCard or KeyEventKind.RedCard));
        var lastScore = last is null ? null : new ProviderScoringPlay(last.Team, $"{name(last.Kind)}: {last.Player}", null, last.Clock);
        return (lastScore, ordered);
    }

    internal static int Minute(string? clock) =>
        int.TryParse(new string((clock ?? "").TakeWhile(char.IsAsciiDigit).ToArray()), out var minute) ? minute : 0;

    internal static int At(ProviderGame game, League league) => game.Status == ProviderStatus.Final
        ? league.Regulation * (league.PeriodClockMinutes ?? 45)
        : Minute(game.DisplayClock);
}
