using System.Collections.Immutable;
using GeoTimeZone;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Venues;
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Live;

// The running board alone can mutate this projection, under its gate. Fetches and venue
// lookups only call outside dependencies and run without the gate. Formatting stays here.
public sealed partial class RunningGameBoard
{
    private sealed class BoardState(
        IGameFeedProvider feed,
        VenueLocator venues,
        VenuePhotos photos,
        IStreamLinkSource streams,
        IOptions<List<League>> leagues,
        TimeProvider clock)
    {
        private readonly Dictionary<string, IReadOnlyList<Game>> _games = new();
        private IReadOnlyList<Game> _snapshot = ImmutableArray<Game>.Empty;

        // The ids of the games the feed last listed as its top events.
        private IReadOnlySet<string> _topEvents = new HashSet<string>();

        // Providers report no end time, so a game ends when the board sees it turn Final. Keyed by game:
        // the status it was last seen with, and for a Final game when it ended.
        private readonly Dictionary<(string LeagueKey, string GameId), (ProviderStatus Status, DateTimeOffset? EndedAt)> _sightings = new();

        public IReadOnlyList<League> Leagues => leagues.Value;

        /// <summary>A consistent snapshot of every game on the board, safe to read while leagues update.</summary>
        public IReadOnlyList<Game> Games => Volatile.Read(ref _snapshot);

        private readonly Dictionary<string, IReadOnlyList<ProviderGame>> _reported = new();

        // Fetching and venue resolution do not touch board state and may run outside its serialization gate.
        public Task<IReadOnlyList<ProviderGame>> FetchLeagueAsync(League league, CancellationToken cancellationToken) =>
            feed.FetchScoreboardAsync(league.Key, cancellationToken);

        public Task<IReadOnlySet<string>> FetchTopEventsAsync(CancellationToken cancellationToken) =>
            feed.FetchTopEventsAsync(cancellationToken);

        /// <summary>Applies basic game data without waiting for optional venue lookups.</summary>
        public IReadOnlyList<GameChange> UpdateLeague(League league, IReadOnlyList<ProviderGame> scoreboard, CancellationToken cancellationToken)
        {
            var now = clock.GetUtcNow();
            ForgetGamesNoLongerReported(league.Key, scoreboard);
            var games = new List<Game>();
            foreach (var reported in scoreboard)
            {
                var game = reported;
                if (ToGameStatus(game.Status) is not { } status)
                    continue;
                var endTime = RecordSighting(league, game, now);
                if (!IsInPinWindow(game, status, endTime, now))
                    continue;
                game = feed.EnrichGame(game, cancellationToken);
                var previous = _reported.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == game.Id);
                var previousGame = _games.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == game.Id);
                var location = venues.Fallback(game.Venue, (game.Contest as ProviderSides)?.Home);
                if (location.FoundBy == LocationSource.Nowhere && previousGame is not null && SameVenue(previous, game)
                    && previousGame.Venue is { Latitude: { } latitude, Longitude: { } longitude })
                    location = new(new Coordinates(latitude, longitude), LocationSource.Venue);
                var added = ToGame(game, status, endTime, league, location);
                games.Add(added with { StreamLinks = streams.LinksFor(added) });
            }

            var before = _games.GetValueOrDefault(league.Key, []);
            _games[league.Key] = games;
            _reported[league.Key] = scoreboard;
            PublishSnapshot();
            return GameChanges.Between(before, games);
        }

        /// <summary>Only games currently inside their pin windows need optional enrichment.</summary>
        public IReadOnlyList<ProviderGame> GamesToEnrich(League league) =>
            _reported.GetValueOrDefault(league.Key, []).Where(g =>
                _games.GetValueOrDefault(league.Key, []).Any(shown => shown.Id == g.Id)).ToList();

        public Task<VenueLocation> LocateVenueAsync(ProviderGame game, CancellationToken cancellationToken) =>
            venues.LocateAsync(game.Venue, (game.Contest as ProviderSides)?.Home, cancellationToken);

        /// <summary>Enriches the current game, preserving any scores received during the lookup.</summary>
        public IReadOnlyList<GameChange> UpdateVenue(League league, ProviderGame requested, VenueLocation location)
        {
            var current = _reported.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == requested.Id);
            if (!SameVenue(current, requested))
                return [];
            var before = _games.GetValueOrDefault(league.Key, []);
            var after = before.Select(g => g.Id == requested.Id
                ? g with { Venue = ToVenue(requested.Venue, location) with { Photo = g.Venue.Photo } }
                : g).ToList();
            _games[league.Key] = after;
            PublishSnapshot();
            return GameChanges.Between(before, after);
        }

        private static bool SameVenue(ProviderGame? a, ProviderGame b) => a is not null &&
            a.Venue == b.Venue && (a.Contest as ProviderSides)?.Home.HomeCity == (b.Contest as ProviderSides)?.Home.HomeCity;

        public IReadOnlyList<GameChange> UpdateTopEvents(IReadOnlySet<string> topEvents, IReadOnlySet<string> currentLeagues)
        {
            _topEvents = topEvents;
            var changes = new List<GameChange>();
            foreach (var (key, before) in _games)
            {
                if (!currentLeagues.Contains(key))
                    continue;
                var after = before.Select(g => g with { TopEvent = topEvents.Contains(g.Id) }).ToList();
                changes.AddRange(GameChanges.Between(before, after));
                _games[key] = after;
            }
            PublishSnapshot();
            return changes;
        }

        private void PublishSnapshot() =>
            Volatile.Write(ref _snapshot, _games.Values.SelectMany(g => g).ToImmutableArray());

        public bool HasLiveGames(League league) =>
            _games.TryGetValue(league.Key, out var games) && games.Any(g => g.Status == GameStatus.Live);

        /// <summary>
        /// A game's status: breaks (halftime, intermissions) arrive as in progress; delays stay Live too.
        /// Postponed, suspended and canceled games are never shown (ADR-0021), so they have none.
        /// </summary>
        private static GameStatus? ToGameStatus(ProviderStatus status) => status switch
        {
            ProviderStatus.Postponed or ProviderStatus.Suspended or ProviderStatus.Canceled => null,
            _ => ToStatus(status),
        };

        /// <summary>A status as a game's or a bout's; a bout postponed, suspended or canceled is Disrupted (called off).</summary>
        private static GameStatus? ToStatus(ProviderStatus status) => status switch
        {
            ProviderStatus.Scheduled => GameStatus.Upcoming,
            ProviderStatus.InProgress or ProviderStatus.Delayed => GameStatus.Live,
            ProviderStatus.Final => GameStatus.Final,
            ProviderStatus.Postponed or ProviderStatus.Suspended or ProviderStatus.Canceled => GameStatus.Disrupted,
            _ => null,
        };

        /// <summary>
        /// For a Final game, when it ended; null for any other game. A game the board saw turn Final ended
        /// when the board first saw it so. A game already Final the first time the board sees it (say, after
        /// the server slept) ended at an unknown time, estimated as its planned end, or now if that is still
        /// to come (ADR-0005).
        /// </summary>
        private DateTimeOffset? RecordSighting(League league, ProviderGame game, DateTimeOffset now)
        {
            var key = (league.Key, game.Id);
            var seenBefore = _sightings.TryGetValue(key, out var last);
            if (game.Status != ProviderStatus.Final)
            {
                _sightings[key] = (game.Status, null);
                return null;
            }
            if (seenBefore && last.Status == game.Status)
                return last.EndedAt;

            var endedAt = seenBefore ? now : Min(game.StartTime + league.PlannedLength, now);
            _sightings[key] = (game.Status, endedAt);
            return endedAt;
        }

        private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;

        private void ForgetGamesNoLongerReported(string leagueKey, IReadOnlyList<ProviderGame> scoreboard)
        {
            var reported = scoreboard.Select(g => g.Id).ToHashSet();
            foreach (var key in _sightings.Keys.ToList())
                if (key.LeagueKey == leagueKey && !reported.Contains(key.GameId))
                    _sightings.Remove(key);
        }

        private static bool IsInPinWindow(ProviderGame game, GameStatus status, DateTimeOffset? endedAt, DateTimeOffset now) => status switch
        {
            GameStatus.Upcoming => now >= game.StartTime - UpcomingWindow,
            GameStatus.Final => now < endedAt + FinalWindow,
            _ => true,
        };

        private Game ToGame(ProviderGame game, GameStatus status, DateTimeOffset? endTime, League league, VenueLocation location)
        {
            return new Game(
                game.Id,
                league.Name,
                league.Sport.DisplayName(),
                game.StartTime,
                status,
                game.Status == ProviderStatus.Delayed,
                endTime,
                ToContest(game.Contest, league),
                ClockLine.For(game, league),
                game.Period,
                ClutchTime.For(game, league),
                HotGame.For(game, league),
                ToVenue(game.Venue, location) with { Photo = photos.PhotoFor(league.Key, game.Venue) },
                StreamLinks: [])
            {
                Note = game.Note,
                Situation = status == GameStatus.Live && game.Situation is { } s
                    ? new GameSituation(s.LastPlay, s.DownAndDistance, s.Possession, s.Balls, s.Strikes, s.Outs, s.OnFirst, s.OnSecond, s.OnThird)
                    : null,
                LastScore = game.LastScore is { } play ? new ScoringPlay(play.Team, play.Text, ClockLine.When(play, league)) : null,
                KeyEvents = game.KeyEvents.Select(k => new KeyEvent(k.Kind, k.Team, k.Player, k.Clock)).ToList(),
                TopEvent = _topEvents.Contains(game.Id),
                Scoreline = Scoreline.For(game, league),
                EspnUrl = game.EspnUrl,
            };
        }

        /// <summary>A venue found nowhere (its lookup pending, or finished with nothing) goes out unplaced: no position or time zone.</summary>
        private static GameVenue ToVenue(ProviderVenue? venue, VenueLocation location)
        {
            var (latitude, longitude) = (location.Location.Latitude, location.Location.Longitude);
            var placed = location.FoundBy != LocationSource.Nowhere;
            var timeZone = placed ? TimeZoneLookup.GetTimeZone(latitude, longitude).Result : null;
            return new GameVenue(venue?.Name, venue?.City, RegionName.InFull(venue?.Region), venue?.Country,
                placed ? latitude : null, placed ? longitude : null, timeZone)
            {
                Court = venue?.Court,
            };
        }

        private static GameContest ToContest(ProviderContest contest, League league) => contest switch
        {
            ProviderSides sides => new GameSides(ToTeam(sides.Home, league), ToTeam(sides.Away, league)),
            ProviderField field => new GameField(field.Entries
                .Select(entrant => new GameEntrant(entrant.Position, entrant.Name, entrant.ShortName, entrant.FlagUrl, ToParText(entrant.ToPar)))
                .ToList()),
            ProviderBouts card => new GameBouts(card.Bouts.Select(ToBout).ToList()),
            _ => throw new ArgumentOutOfRangeException(nameof(contest), contest, "No such contest"),
        };

        private static GameBout ToBout(ProviderBout bout) => new(
            bout.Id, ToBoutSide(bout.First), ToBoutSide(bout.Second), bout.WeightClass, bout.ScheduledRounds,
            ToStatus(bout.Status) ?? GameStatus.Upcoming, bout.Round, bout.Clock, ClockLine.MethodName(bout.Method));

        private static GameBoutSide ToBoutSide(ProviderBoutSide side) => new(side.Name, side.ShortName, side.FlagUrl, side.Record, side.Winner);

        private static GameTeam ToTeam(ProviderTeam team, League league) =>
            new(team.Abbreviation, team.FullName, team.LogoUrl, ScoreText(team), team.Rank, team.Record,
                league.ConferenceName(team.ConferenceId));

        /// <summary>A score to par as golf writes it: "-12", "E" (level) or "+3".</summary>
        private static string? ToParText(int? toPar) => toPar switch
        {
            null => null,
            0 => "E",
            > 0 => $"+{toPar}",
            _ => toPar.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
        };

        /// <summary>The team's score as its sport writes it: "24", or in cricket "186/6", or "127" all out.</summary>
        private static string? ScoreText(ProviderTeam team) => (team.Score, team.Innings?.Wickets) switch
        {
            (null, _) => null,
            ({ } runs, { } wickets) => $"{runs}/{wickets}",
            ({ } score, _) => score.ToString(System.Globalization.CultureInfo.InvariantCulture),
        };
    }
}
