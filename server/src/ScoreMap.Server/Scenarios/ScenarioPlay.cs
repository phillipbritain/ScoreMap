using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's games under play (<c>"play": true</c>, ADR-0009), as they stand at any time on the
/// scenario clock after it started. The games play like real games: Live games score at roughly their
/// sport's margins, the clock and period move forward, they go to breaks and they finish; Upcoming
/// games start. A game that has been Final for <see cref="DropsOutAfter"/> drops out, and a new game takes its place at a random venue, Upcoming or straight into Live, so the number of Live games stays roughly steady.
/// </summary>
/// <remarks>
/// Play moves on in steps of <see cref="Step"/> of scenario time counted from the scenario's start, so
/// with the same seed the games at a given reading of the scenario clock are the same however often
/// they are asked for, whatever speed changes were made on the way. Games play as fast as real
/// games: the scenario clock's speed is what makes them play faster. <see cref="GamesAt"/> takes a
/// lock, so the poller and a newly connected browser can ask at once.
/// </remarks>
public sealed class ScenarioPlay
{
    /// <summary>How often play moves on, in scenario time.</summary>
    public static readonly TimeSpan Step = TimeSpan.FromSeconds(1);

    /// <summary>How long a Final game stays before a new game takes its place, in scenario time.</summary>
    public static readonly TimeSpan DropsOutAfter = TimeSpan.FromMinutes(1);

    /// <summary>The share of new games that start Upcoming (soon) rather than straight into Live.</summary>
    private const double UpcomingShare = 0.25;

    private readonly string _scenario;
    private readonly PlaySettings _settings;
    private readonly DateTimeOffset _startedAt;
    private readonly Random _random;
    private readonly List<PlayedGame> _games;
    private readonly Lock _lock = new();
    private long _steps;
    private int _newGames;

    public ScenarioPlay(Scenario scenario, DateTimeOffset startedAt, Random random)
    {
        _scenario = scenario.Name;
        _settings = scenario.Play ?? throw new ArgumentException($"Scenario \"{scenario.Name}\" doesn't have play", nameof(scenario));
        _startedAt = startedAt;
        _random = random;
        _games = scenario.Games.Select(game => Begin(game, startedAt)).ToList();
    }

    /// <summary>
    /// The games as the feed reports them when the scenario clock reads <paramref name="now"/>. Time never
    /// goes back: an earlier time gives the games as they last were.
    /// </summary>
    public IReadOnlyList<ProviderGame> GamesAt(DateTimeOffset now)
    {
        lock (_lock)
        {
            var due = (now - _startedAt).Ticks / Step.Ticks;
            while (_steps < due)
            {
                _steps++;
                MoveOn(_startedAt + Step * _steps);
            }
            return _games.Select(game => game.Game).ToList();
        }
    }

    private void MoveOn(DateTimeOffset at)
    {
        for (var i = 0; i < _games.Count; i++)
        {
            var played = _games[i];
            switch (played.Game.Status)
            {
                case ProviderStatus.Scheduled when at >= played.Game.StartTime:
                    Moved(played, played.Play.Start(played.Game, StepOf(played), _random), at);
                    break;
                case ProviderStatus.InProgress:
                    Moved(played, played.Play.Step(played.Game, played.Through, StepOf(played), _random), at);
                    break;
                case ProviderStatus.Final when at - played.FinishedAt >= DropsOutAfter:
                    // Without teams free for a new game, the old one stays until some are.
                    _games[i] = NewGame(at, replacing: played) ?? played;
                    break;
            }
        }
    }

    /// <summary>How far one step moves a game through its planned length.</summary>
    private static double StepOf(PlayedGame played) => Step / played.League.PlannedLength;

    /// <summary>A game as a step of play left it, stopped if that finished it.</summary>
    private static void Moved(PlayedGame played, Played moved, DateTimeOffset at)
    {
        (played.Game, played.Through) = moved;
        if (played.Game.Status == ProviderStatus.Final)
            played.FinishedAt = at;
    }

    /// <summary>
    /// A new game at a venue no game is at (if there is one), between teams in no other game showing,
    /// Upcoming and starting soon, or straight into Live. The teams of the game it is
    /// <paramref name="replacing"/> are free again, so a scenario filled with as many games as its teams
    /// have room for can still bring new ones on. Null if no league has two teams free, which can happen
    /// when the game replaced is between teams the team list doesn't have (one written out).
    /// </summary>
    private PlayedGame? NewGame(DateTimeOffset at, PlayedGame replacing)
    {
        if (replacing.Game.Contest is not ProviderSides)
        {
            var replacementId = $"{_scenario}-play-{++_newGames}";
            var contest = replacing.Scenario.Replayed(replacing.Game.Contest, replacementId);
            return new PlayedGame(replacing.Game with { Id = replacementId, Contest = contest, Status = ProviderStatus.Scheduled,
                StartTime = at + TimeSpan.FromSeconds(30), Period = null, DisplayClock = null }, replacing.League);
        }
        var inUse = _games.Select(game => game.Game.Venue?.Name).ToHashSet();
        var free = _settings.Venues.Where(venue => !inUse.Contains(venue.Name)).ToList();
        var venues = free.Count > 0 ? free : _settings.Venues;
        var venue = venues[_random.Next(venues.Count)];
        var id = $"{_scenario}-play-{_newGames + 1}";
        var playing = _games.Where(game => game != replacing)
            .Where(game => game.Game.Contest is ProviderSides)
            .SelectMany(game => PlayingTeam.In(game.Game.LeagueKey, game.Game.Sides().Home, game.Game.Sides().Away)).ToList();
        ScenarioGame made;
        try
        {
            made = _random.NextDouble() < UpcomingShare
                ? _settings.Maker.Make(id, venue, GameStatus.Upcoming, playing, _random) with { StartsIn = TimeSpan.FromSeconds(_random.Next(60, 181)) }
                : _settings.Maker.Make(id, venue, GameStatus.Live, playing, _random);
        }
        catch (NotEnoughTeamsException)
        {
            return null;
        }
        _newGames++;
        return Begin(made, at);
    }

    /// <summary>
    /// A game as play takes it on at <paramref name="at"/>. A Live one's clock is set by how far in it is;
    /// a Final one has been so for a random part of <see cref="DropsOutAfter"/>, so the games a
    /// scenario starts with don't all drop out at once.
    /// </summary>
    private PlayedGame Begin(ScenarioGame game, DateTimeOffset at)
    {
        var league = _settings.Leagues.Single(l => l.Key == game.LeagueKey);
        var played = new PlayedGame(game.ToProviderGame(at), league) { FinishedAt = at };
        if (game.Status == ProviderStatus.Final)
            played.FinishedAt = at - DropsOutAfter * _random.NextDouble();
        // Where the scenario says it stands, if it says; otherwise however far its start time puts it.
        if (game.Status == ProviderStatus.InProgress)
            (played.Game, played.Through) = played.Play.TakeOn(played.Game, -game.StartsIn / league.PlannedLength);
        return played;
    }

    private sealed class PlayedGame
    {
        public PlayedGame(ProviderGame game, League league)
        {
            Game = game;
            League = league;
            Scenario = ScenarioSports.For(league);
            Play = Scenario.PlayFor(game.Contest);
        }

        public SportScenario Scenario { get; }

        public ProviderGame Game { get; set; }

        public League League { get; }

        /// <summary>How it moves on, chosen by the shape of its contest.</summary>
        public GamePlay Play { get; }

        /// <summary>How far through the game it is, from 0 (just started) to 1 (finished).</summary>
        public double Through { get; set; }

        /// <summary>When the game went Final.</summary>
        public DateTimeOffset FinishedAt { get; set; }
    }
}
