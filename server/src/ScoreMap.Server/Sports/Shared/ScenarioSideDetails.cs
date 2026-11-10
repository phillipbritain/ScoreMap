using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal abstract partial class SportScenario
{
    internal SportScenarioDetails CreateDetails() => new(League, this);
    internal virtual bool HasPlayDetails => true;
    internal virtual int Minute(ProviderGame game) => 0;

    internal virtual ProviderTeam WithRecord(ProviderTeam team)
    {
        var random = Seeded(League.Key, team.FullName);
        var played = PlayedGames(random);
        var wins = random.Next(played + 1);
        var record = Record(random, played, wins);
        var college = League.Key.Contains("college", StringComparison.Ordinal);
        return team with { Record = record, Rank = college && random.NextDouble() < 0.25 ? random.Next(1, 26) : null };
    }

    protected virtual int PlayedGames(Random random) => random.Next(5, 60);
    protected virtual string Record(Random random, int played, int wins) => $"{wins}-{played - wins}";

    internal string? Note(ProviderGame game)
    {
        var random = Seeded(game.Id, "note");
        if (random.NextDouble() >= 1.0 / 6)
            return null;
        return NoteText(random);
    }

    protected abstract string NoteText(Random random);

    internal virtual (ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents) Events(
        ProviderGame game, ScenarioSeen? seen, int minute) => (Scored(game, seen) ?? seen?.LastScore, []);

    /// <summary>The points a game's first score usually is, for the last score's text.</summary>
    protected virtual int UsualScore => 1;

    /// <summary>
    /// How a score of <paramref name="points"/> reads as the last score, for a sport that keeps
    /// <see cref="Events"/>' default; none by default.
    /// </summary>
    protected virtual string? ScoreText(int points, Random random) => null;
    protected virtual ProviderPeriodPhase ScorePhase(ProviderGame game) => ProviderPeriodPhase.Playing;
    protected virtual string? ScoreClock(ProviderGame game) => game.DisplayClock;

    private ProviderScoringPlay? Scored(ProviderGame game, ScenarioSeen? seen)
    {
        var sides = game.Sides();
        var (home, away) = (sides.Home.Score ?? 0, sides.Away.Score ?? 0);
        int homeGained, awayGained;
        if (seen is not null)
            (homeGained, awayGained) = (home - (seen.Home ?? 0), away - (seen.Away ?? 0));
        else
        {
            var homeScored = home > 0 && (away == 0 || Seeded(game.Id, "first").Next(2) == 0);
            (homeGained, awayGained) = homeScored ? (Math.Min(UsualScore, home), 0) : (0, Math.Min(UsualScore, away));
        }
        if (homeGained <= 0 && awayGained <= 0)
            return null;
        var team = homeGained > 0 ? sides.Home : sides.Away;
        var points = homeGained > 0 ? homeGained : awayGained;
        var random = Seeded(game.Id, $"{home}-{away}");
        if (ScoreText(points, random) is not { } text)
            return null;
        return new ProviderScoringPlay(team.Abbreviation, text, game.Period, ScoreClock(game), ScorePhase(game));
    }

    internal virtual ProviderSituation? Situation(ProviderGame game) => null;

    protected static Random SituationRandom(ProviderGame game)
    {
        var clockMinute = (game.DisplayClock ?? "").Split(':')[0];
        var sides = game.Sides();
        return Seeded(game.Id, $"situation {game.Period} {game.Phase} {clockMinute} {sides.Home.Score}-{sides.Away.Score}");
    }
}
