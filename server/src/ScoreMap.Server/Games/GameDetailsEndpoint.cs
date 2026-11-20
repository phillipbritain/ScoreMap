using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Games;

public static partial class GameDetailsEndpoint
{
    /// <summary>
    /// GET /api/game-details: the details of a game on the board, or with <c>demo=true</c> on the demo
    /// board (ADR-0019), whose games' details are made up (see <see cref="ScenarioGameDetails"/>).
    /// </summary>
    public static WebApplication MapGameDetails(this WebApplication app)
    {
        app.MapGet("/api/game-details", async (string id, string league, bool? demo, RunningGameBoard board,
            DemoBoard demos, IOptions<List<League>> leagues, CancellationToken cancellationToken) =>
        {
            var configured = leagues.Value.FirstOrDefault(item => item.Name == league);
            var games = demo == true ? demos.Running : board;
            if (configured is null || games is null)
                return Results.NotFound();

            var (lookup, details) = await games.FetchGameDetailsAsync(configured, id, cancellationToken);
            return lookup switch
            {
                DetailsLookup.Found => Results.Ok(details),
                DetailsLookup.NotOnBoard => Results.NotFound(),
                _ => Results.StatusCode(StatusCodes.Status502BadGateway),
            };
        });

        // The welcome tour's games are made up in the browser, so it sends the game, in the game list's shape.
        app.MapPost("/api/tour-game-details", async (HttpRequest request, IOptions<List<League>> leagues,
            CancellationToken cancellationToken) =>
        {
            TourGame? game;
            try
            {
                game = await JsonSerializer.DeserializeAsync<TourGame>(request.Body, TourJson, cancellationToken);
            }
            catch (JsonException)
            {
                return Results.BadRequest();
            }
            var configured = leagues.Value.FirstOrDefault(item => item.Name == game?.League);
            if (game is null || configured is null || !game.Id.StartsWith(TourGamePrefix, StringComparison.Ordinal))
                return Results.NotFound();
            return Results.Ok(ScenarioGameDetails.For(configured, game.ToProviderGame(configured)));
        });
        return app;
    }

    /// <summary>How the welcome tour's games' ids begin; nothing else is made up details for.</summary>
    public const string TourGamePrefix = "tour-";

    private static readonly JsonSerializerOptions TourJson = new(JsonSerializerDefaults.Web) { AllowOutOfOrderMetadataProperties = true };

    [GeneratedRegex(@"^(?:(?:Q|P|H|R|Top |Bot |Mid |End |Round |Lap |Set )(?<numbered>\d+)|(?<ordinal>\d+)(?:st|nd|rd|th)\b)")]
    private static partial Regex PeriodInClock();

    /// <summary>The parts of a welcome tour's game that its made-up details are made from.</summary>
    private sealed record TourGame(string Id, string League, GameStatus Status, GameContest Contest, string? Clock, int? Period, string? Note)
    {
        public ProviderGame ToProviderGame(League league) => new(Id, league.Key, DateTimeOffset.UnixEpoch, Contest switch
            {
                GameSides sides => new ProviderSides(Team(sides.Home), Team(sides.Away)),
                GameField field => new ProviderField(field.Entries.Select(entrant =>
                    new ProviderEntrant(entrant.Position, entrant.Name, entrant.ShortName, entrant.FlagUrl, LogoUrl: entrant.LogoUrl)).ToList()),
                GameBouts card => new ProviderBouts(card.Bouts.Select(bout => new ProviderBout(bout.Id,
                    Side(bout.First), Side(bout.Second), bout.WeightClass, bout.ScheduledRounds, Provider(bout.Status),
                    bout.Round, bout.Clock)).ToList()),
                _ => new ProviderField([]),
            }, Provider(Status), Clock, Period ?? FirstNumber(Clock) ?? Half(league, Clock), Venue: null, Phase(Clock))
        {
            Note = Note,
        };

        private static ProviderTeam Team(GameTeam team) => new(team.Abbreviation, team.FullName, team.LogoUrl,
            int.TryParse(new string((team.Score ?? "").TakeWhile(char.IsAsciiDigit).ToArray()), out var score) ? score : null);

        // The tour's examples give their period only in their clock line ("Q2 6:24", "2nd 8:04", "Bot 6th", "Round 2", "Lap 42"), not a soccer minute ("62'").
        private static int? FirstNumber(string? clock) =>
            clock is not null && PeriodInClock().Match(clock) is { Success: true } match
                ? int.Parse(match.Groups["numbered"].Success ? match.Groups["numbered"].Value : match.Groups["ordinal"].Value, CultureInfo.InvariantCulture)
                : null;

        // A soccer or rugby clock line is the minute ("62'"), in the second half past the first's length.
        private static int? Half(League league, string? clock) =>
            league.Sport is Sport.Soccer or Sport.Rugby && clock is not null && clock.EndsWith('\'')
            && int.TryParse(clock.Split('\'', '+')[0], out var minute)
                ? minute > (league.Sport == Sport.Soccer ? 45 : 40) ? 2 : 1
                : null;

        private static ProviderBoutSide Side(GameBoutSide side) => new(side.Name, side.ShortName, side.FlagUrl, side.Record, side.Winner);

        private static ProviderStatus Provider(GameStatus status) => status switch
        {
            GameStatus.Upcoming => ProviderStatus.Scheduled,
            GameStatus.Live => ProviderStatus.InProgress,
            GameStatus.Final => ProviderStatus.Final,
            _ => ProviderStatus.Suspended,
        };

        // A baseball clock line says which half of the inning it is ("Top 6th", "Bot 6th").
        private static ProviderPeriodPhase Phase(string? clock) => clock switch
        {
            not null when clock.StartsWith("Top", StringComparison.Ordinal) => ProviderPeriodPhase.InningTop,
            not null when clock.StartsWith("Bot", StringComparison.Ordinal) => ProviderPeriodPhase.InningBottom,
            _ => ProviderPeriodPhase.Playing,
        };
    }
}
