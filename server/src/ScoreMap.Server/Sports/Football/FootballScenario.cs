using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed class FootballScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(3.5, [(7, 0.7), (3, 0.3)], 47, 3));

    protected override int Capacity => League.Key.Contains("college", StringComparison.Ordinal) ? 85000 : 68000;
    protected override int UsualScore => 7;
    protected override string NoteText(Random random) => Pick(random, "Rivalry Week", "Homecoming", "Wild Card Playoffs", "International Series");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) =>
        ($"{favourite.Abbreviation} -{Number(Between(random, 1, 14, 0.5))}", Between(random, 37.5, 55.5, 1));
    protected override int PlayedGames(Random random) => random.Next(2, 13);

    protected override string ScoreText(int points, Random random) => points switch
    {
        3 => $"{Player(random)} {random.Next(20, 56)} Yd Field Goal",
        2 => $"{Player(random)} Safety",
        _ when random.Next(2) == 0 => $"{Player(random)} {random.Next(1, 40)} Yd Run ({Player(random)} Kick)",
        _ => $"{Player(random)} {random.Next(1, 60)} Yd pass from {Player(random)} ({Player(random)} Kick)",
    };

    internal override ProviderSituation? Situation(ProviderGame game)
    {
        var random = SituationRandom(game);
        var sides = game.Sides();
        var (offence, defence) = random.Next(2) == 0 ? (sides.Home, sides.Away) : (sides.Away, sides.Home);
        var down = random.Next(1, 5);
        var distance = down == 1 ? 10 : random.Next(1, 11);
        var yardLine = random.Next(1, 50);
        var side = random.Next(2) == 0 ? offence : defence;
        var lastPlay = Pick(random,
            $"{Player(random)} run for {random.Next(-2, 15)} yards",
            $"{Player(random)} pass short {Pick(random, "left", "middle", "right")} to {Player(random)} for {random.Next(1, 20)} yards",
            $"{Player(random)} pass incomplete deep {Pick(random, "left", "right")} to {Player(random)}");
        return new ProviderSituation(lastPlay, $"{Ordinal(down)} & {distance} at {side.Abbreviation} {yardLine}", offence.Abbreviation);
    }
}
