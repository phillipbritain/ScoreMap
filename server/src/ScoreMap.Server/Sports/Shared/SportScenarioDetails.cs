using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>One league's fabricated details and retained observations, private to a scenario provider.</summary>
internal sealed class SportScenarioDetails(League league, SportScenario sport)
{
    private readonly Dictionary<string, ScenarioSeen> _seen = new();

    internal IReadOnlyList<ProviderGame> Fill(IReadOnlyList<ProviderGame> games)
    {
        var ids = games.Select(game => game.Id).ToHashSet();
        foreach (var id in _seen.Keys.Where(id => id.StartsWith($"{league.Key}/", StringComparison.Ordinal) && !ids.Contains(id[(league.Key.Length + 1)..])).ToList())
            _seen.Remove(id);
        return games.Select(Fill).ToList();
    }

    private ProviderGame Fill(ProviderGame game)
    {
        // A race has none of a two-sided game's detail; ESPN gives it none either.
        if (game.Contest is not ProviderSides)
            return game;
        if (sport is TennisScenario)
            game = TennisScenario.Written(game);
        var sides = game.Sides();
        var started = sides.Home.Score is not null || sides.Away.Score is not null;
        game = game with
        {
            Contest = new ProviderSides(sport.WithRecord(sides.Home), sport.WithRecord(sides.Away)),
            Note = sport.Note(game),
        };
        if (!started || !sport.HasPlayDetails)
            return game;

        var key = $"{league.Key}/{game.Id}";
        var seen = _seen.GetValueOrDefault(key);
        // A Final game has no clock, so has played its whole game.
        var minute = sport.Minute(game);
        var (lastScore, keyEvents) = sport.Events(game, seen, minute);
        _seen[key] = new ScenarioSeen(sides.Home.Score, sides.Away.Score, lastScore, keyEvents, Math.Max(minute, seen?.Minute ?? 0));

        return game with
        {
            LastScore = lastScore,
            KeyEvents = keyEvents,
            Situation = game.Status == ProviderStatus.InProgress && game.Phase is not ProviderPeriodPhase.Break
                ? sport.Situation(game)
                : null,
        };
    }
}

internal sealed record ScenarioSeen(int? Home, int? Away, ProviderScoringPlay? LastScore,
    IReadOnlyList<ProviderKeyEvent> KeyEvents, int Minute);
