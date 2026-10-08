using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's games under random play (ADR-0009), as they stand at any time on the scenario clock
/// after it started.
/// Live games move on by themselves: they score at roughly their sport's margins, the clock and
/// period move forward, and they go to breaks and finish. A game that has been Final for
/// <see cref="FinalStays"/> drops out, and a new game takes its place at a random venue, Upcoming
/// or straight into Live, so the number of Live games stays roughly steady.
/// </summary>
/// <remarks>
/// Play moves on in steps of <see cref="Step"/> of scenario time counted from the scenario's start, so
/// with the same seed the games at a given reading of the scenario clock are the same however often
/// they are asked for, whatever speed changes were made on the way. Games play as fast as real
/// games: the scenario clock's speed is what makes them play faster. <see cref="GamesAt"/> takes a
/// lock, so the poller and a newly connected browser can ask at once.
/// </remarks>
public sealed class RandomPlayGames
{
    /// <summary>How often play moves on, in scenario time.</summary>
    public static readonly TimeSpan Step = TimeSpan.FromSeconds(1);

    /// <summary>How long a Final game stays before a new game takes its place, in scenario time.</summary>
    public static readonly TimeSpan FinalStays = TimeSpan.FromMinutes(1);

    /// <summary>The share of new games that start Upcoming (soon) rather than straight into Live.</summary>
    private const double UpcomingShare = 0.25;

    private readonly string _scenario;
    private readonly RandomPlay _play;
    private readonly DateTimeOffset _startedAt;
    private readonly Random _random;
    private readonly List<PlayedGame> _games;
    private readonly Lock _lock = new();
    private long _steps;
    private int _newGames;

    public RandomPlayGames(Scenario scenario, DateTimeOffset startedAt, Random random)
    {
        _scenario = scenario.Name;
        _play = scenario.Play ?? throw new ArgumentException($"Scenario \"{scenario.Name}\" doesn't have random play", nameof(scenario));
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
                    played.Through = 0;
                    played.Game = played.Game with
                    {
                        Status = ProviderStatus.InProgress,
                        Home = played.Game.Home with { Score = 0 },
                        Away = played.Game.Away with { Score = 0 },
                    };
                    played.Game = Position(played);
                    break;
                case ProviderStatus.InProgress:
                    Play(played, at);
                    break;
                case ProviderStatus.Final when at - played.FinalAt >= FinalStays:
                    _games[i] = NewGame(at);
                    break;
            }
        }
    }

    /// <summary>One step of a Live game: it may score, then its clock moves on, perhaps to a break or the end.</summary>
    private void Play(PlayedGame played, DateTimeOffset at)
    {
        var sport = played.Sport;
        var step = Step / played.League.PlannedLength;
        if (sport.IsPlaying(played.Through))
        {
            played.Game = played.Game with
            {
                Home = Score(played.Game.Home, sport, step),
                Away = Score(played.Game.Away, sport, step),
            };
        }
        played.Through += step;
        if (played.Through < 1)
        {
            played.Game = Position(played);
            return;
        }

        // A game that would end level, in a sport without draws, is settled by one more score.
        var game = played.Game;
        if (sport.SettlingScore is { } settle && game.Home.Score == game.Away.Score)
        {
            game = _random.Next(2) == 0
                ? game with { Home = game.Home with { Score = game.Home.Score + settle } }
                : game with { Away = game.Away with { Score = game.Away.Score + settle } };
        }
        played.Game = game with { Status = ProviderStatus.Final, Period = sport.Regulation, Phase = ProviderPeriodPhase.Playing };
        played.FinalAt = at;
    }

    private ProviderTeam Score(ProviderTeam team, SportPlay sport, double step)
    {
        var score = team.Score ?? 0;
        if (_random.NextDouble() >= sport.ChanceToScore(step) || score >= sport.MostPoints)
            return team;
        return team with { Score = Math.Min(sport.MostPoints, score + sport.Points(_random)) };
    }

    private static ProviderGame Position(PlayedGame played)
    {
        var (period, clock, phase) = played.Sport.Position(played.Through);
        return played.Game with { Period = period, DisplayClock = clock, Phase = phase };
    }

    /// <summary>A new game at a venue no game is at (if there is one), Upcoming and starting soon, or straight into Live.</summary>
    private PlayedGame NewGame(DateTimeOffset at)
    {
        var inUse = _games.Select(game => game.Game.Venue?.Name).ToHashSet();
        var free = _play.Venues.Where(venue => !inUse.Contains(venue.Name)).ToList();
        var venues = free.Count > 0 ? free : _play.Venues;
        var venue = venues[_random.Next(venues.Count)];
        var id = $"{_scenario}-play-{++_newGames}";
        if (_random.NextDouble() < UpcomingShare)
        {
            var upcoming = _play.Maker.Make(id, venue, GameStatus.Upcoming, _random)
                with { StartsIn = TimeSpan.FromSeconds(_random.Next(60, 181)) };
            return Begin(upcoming, at);
        }
        return Begin(_play.Maker.Make(id, venue, GameStatus.Live, _random), at);
    }

    /// <summary>A game as random play takes it on at <paramref name="at"/>; a Live one's clock is set by how far in it is.</summary>
    private PlayedGame Begin(ScenarioGame game, DateTimeOffset at)
    {
        var league = _play.Leagues.Single(l => l.Key == game.LeagueKey);
        var played = new PlayedGame(game.ToProviderGame(at), league) { FinalAt = at };
        if (game.Status == ProviderStatus.InProgress)
        {
            played.Through = Math.Clamp(-game.StartsIn / league.PlannedLength, 0, 0.95);
            played.Game = Position(played);
        }
        return played;
    }

    private sealed class PlayedGame(ProviderGame game, League league)
    {
        public ProviderGame Game { get; set; } = game;

        public League League { get; } = league;

        public SportPlay Sport { get; } = new(league);

        /// <summary>How far through the game it is, from 0 (just started) to 1 (finished).</summary>
        public double Through { get; set; }

        /// <summary>When the game went Final.</summary>
        public DateTimeOffset FinalAt { get; set; }
    }
}
