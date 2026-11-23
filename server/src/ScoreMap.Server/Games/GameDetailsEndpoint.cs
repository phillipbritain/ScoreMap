using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Games;

public static class GameDetailsEndpoint
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

        // The welcome tour's games are made up in the browser, so it sends the facts the details need.
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

    private static readonly JsonSerializerOptions TourJson = new(JsonSerializerDefaults.Web)
    {
        AllowOutOfOrderMetadataProperties = true,
        Converters = { new JsonStringEnumConverter<ProviderPeriodPhase>(allowIntegerValues: false) },
    };

    /// <summary>The parts of a welcome tour's game that its made-up details are made from.</summary>
    private sealed record TourGame(string Id, string League, GameStatus Status, GameContest Contest,
        int? Period, ProviderPeriodPhase Phase, int? HomeScore, int? AwayScore, int? Minute, string? Note)
    {
        // Soccer's minute supplies the scenario details' clock for timing scoring plays.
        private string? ScenarioClock => Minute is { } minute ? minute.ToString(CultureInfo.InvariantCulture) + "'" : null;

        public ProviderGame ToProviderGame(League league) => new(Id, league.Key, DateTimeOffset.UnixEpoch, Contest switch
            {
                GameSides sides => new ProviderSides(Team(sides.Home, HomeScore), Team(sides.Away, AwayScore)),
                GameField field => new ProviderField(field.Entries.Select(entrant =>
                    new ProviderEntrant(entrant.Position, entrant.Name, entrant.ShortName, entrant.FlagUrl, LogoUrl: entrant.LogoUrl, CarNumber: entrant.CarNumber)).ToList()),
                GameBouts card => new ProviderBouts(card.Bouts.Select(bout => new ProviderBout(bout.Id,
                    Side(bout.First), Side(bout.Second), bout.WeightClass, bout.ScheduledRounds, Provider(bout.Status),
                    bout.Round, bout.Clock)).ToList()),
                _ => new ProviderField([]),
            }, Provider(Status), ScenarioClock, Period, Venue: null, Phase)
        {
            Note = Note,
        };
        private static ProviderTeam Team(GameTeam team, int? score) => new(team.Abbreviation, team.FullName, team.LogoUrl, score);

        private static ProviderBoutSide Side(GameBoutSide side) => new(side.Name, side.ShortName, side.FlagUrl, side.Record, side.Winner);

        private static ProviderStatus Provider(GameStatus status) => status switch
        {
            GameStatus.Upcoming => ProviderStatus.Scheduled,
            GameStatus.Live => ProviderStatus.InProgress,
            GameStatus.Final => ProviderStatus.Final,
            _ => ProviderStatus.Suspended,
        };

    }
}
