using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's games under play (<c>"play": true</c>, ADR-0009), as they stand at any time on the
/// scenario clock after it started. The games play like real games: Live games score at roughly their
/// sport's margins, the clock and period move forward, they go to breaks and they finish; Upcoming
/// games start. Play disrupts games to keep the scenario's share of them Disrupted: an Upcoming game
/// is Postponed or Canceled, a Live one Suspended with its score and period. A game that has been
/// Final or Disrupted for <see cref="DropsOutAfter"/> drops out, and a new game takes its place at a
/// random venue, Upcoming or straight into Live, so the number of Live games stays roughly steady.
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

    /// <summary>How long a Final or Disrupted game stays before a new game takes its place, in scenario time.</summary>
    public static readonly TimeSpan DropsOutAfter = TimeSpan.FromMinutes(1);

    /// <summary>The share of new games that start Upcoming (soon) rather than straight into Live.</summary>
    private const double UpcomingShare = 0.25;

    /// <summary>
    /// With one game fewer Disrupted than play aims for, about how long until play disrupts one, in
    /// scenario time; with a fraction of a game fewer, proportionately longer.
    /// </summary>
    private static readonly TimeSpan DisruptionTakes = TimeSpan.FromSeconds(5);

    /// <summary>
    /// How far above the scenario's share play aims, as a multiple of it. A Disrupted game that drops out
    /// leaves its place empty for a few seconds before play disrupts another, so aiming at the share
    /// itself would keep a little under it.
    /// </summary>
    private const double AimAbove = 1.1;

    /// <summary>The share of the Upcoming games play disrupts that are Postponed rather than Canceled.</summary>
    private const double PostponedShare = 2.0 / 3;

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
        // First, so a game is disrupted as it stood, and a Live one suspended keeps the score it had.
        Disrupt(at);
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
                case var status when (status == ProviderStatus.Final || IsDisrupted(status)) && at - played.StoppedAt >= DropsOutAfter:
                    _games[i] = NewGame(at, replacing: played);
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

        var game = played.Game;
        var (home, away) = sport.Settled(game.Home.Score ?? 0, game.Away.Score ?? 0, _random);
        played.Game = game with
        {
            Home = game.Home with { Score = home },
            Away = game.Away with { Score = away },
            Status = ProviderStatus.Final,
            Period = sport.Regulation,
            Phase = ProviderPeriodPhase.Playing,
        };
        played.StoppedAt = at;
    }

    /// <summary>
    /// Steers towards the scenario's share of Disrupted games: the further short of it, the likelier play
    /// disrupts a game this step, an Upcoming or Live one at random that the scenario didn't write out.
    /// An Upcoming game is Postponed or Canceled before it starts, so it has no score; a Live one is
    /// Suspended, keeping its score and period.
    /// </summary>
    private void Disrupt(DateTimeOffset at)
    {
        var shortBy = _settings.DisruptedShare * AimAbove * _games.Count - _games.Count(played => IsDisrupted(played.Game.Status));
        if (shortBy <= 0 || _random.NextDouble() >= shortBy * (Step / DisruptionTakes))
            return;
        var candidates = _games
            .Where(played => played.Game.Status is ProviderStatus.Scheduled or ProviderStatus.InProgress)
            .Where(played => !_settings.WrittenOut.Contains(played.Game.Id))
            .ToList();
        if (candidates.Count == 0)
            return;
        var chosen = candidates[_random.Next(candidates.Count)];
        var status = chosen.Game.Status == ProviderStatus.InProgress ? ProviderStatus.Suspended
            : _random.NextDouble() < PostponedShare ? ProviderStatus.Postponed
            : ProviderStatus.Canceled;
        chosen.Game = chosen.Game with { Status = status };
        chosen.StoppedAt = at;
    }

    private static bool IsDisrupted(ProviderStatus status) =>
        status is ProviderStatus.Postponed or ProviderStatus.Suspended or ProviderStatus.Canceled;

    private ProviderTeam Score(ProviderTeam team, SportPlay sport, double step) =>
        team with { Score = sport.ScoreStep(team.Score ?? 0, step, _random) };

    private static ProviderGame Position(PlayedGame played)
    {
        var (period, clock, phase) = played.Sport.Position(played.Through);
        return played.Game with { Period = period, DisplayClock = clock, Phase = phase };
    }

    /// <summary>
    /// A new game at a venue no game is at (if there is one), between teams in no other game showing,
    /// Upcoming and starting soon, or straight into Live. The teams of the game it is
    /// <paramref name="replacing"/> are free again, so a scenario filled with as many games as its teams
    /// have room for can still bring new ones on.
    /// </summary>
    private PlayedGame NewGame(DateTimeOffset at, PlayedGame replacing)
    {
        var inUse = _games.Select(game => game.Game.Venue?.Name).ToHashSet();
        var free = _settings.Venues.Where(venue => !inUse.Contains(venue.Name)).ToList();
        var venues = free.Count > 0 ? free : _settings.Venues;
        var venue = venues[_random.Next(venues.Count)];
        var id = $"{_scenario}-play-{++_newGames}";
        var playing = ScenarioGameMaker.Playing(_games.Where(game => game != replacing).Select(game => game.Game)).ToList();
        if (_random.NextDouble() < UpcomingShare)
        {
            var upcoming = _settings.Maker.Make(id, venue, GameStatus.Upcoming, playing, _random)
                with { StartsIn = TimeSpan.FromSeconds(_random.Next(60, 181)) };
            return Begin(upcoming, at);
        }
        return Begin(_settings.Maker.Make(id, venue, GameStatus.Live, playing, _random), at);
    }

    /// <summary>
    /// A game as play takes it on at <paramref name="at"/>. A Live one's clock is set by how far in it is;
    /// a Final or Disrupted one has been so for a random part of <see cref="DropsOutAfter"/>, so the games a
    /// scenario starts with don't all drop out at once.
    /// </summary>
    private PlayedGame Begin(ScenarioGame game, DateTimeOffset at)
    {
        var league = _settings.Leagues.Single(l => l.Key == game.LeagueKey);
        var played = new PlayedGame(game.ToProviderGame(at), league) { StoppedAt = at };
        if (game.Status == ProviderStatus.Final || IsDisrupted(game.Status))
            played.StoppedAt = at - DropsOutAfter * _random.NextDouble();
        if (game.Status == ProviderStatus.InProgress)
        {
            // Where the scenario says it stands, if it says; otherwise however far its start time puts it.
            var written = game.Period is { } period ? played.Sport.Through(period, game.Clock, game.Phase) : null;
            played.Through = Math.Clamp(written ?? -game.StartsIn / league.PlannedLength, 0, 0.95);
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

        /// <summary>When the game went Final or was Disrupted.</summary>
        public DateTimeOffset StoppedAt { get; set; }
    }
}
