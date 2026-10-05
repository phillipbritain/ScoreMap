using System.Net.Http.Json;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// Reads ESPN's unofficial scoreboard endpoints (ADR-0001) and turns them into
/// provider-neutral games. All knowledge of ESPN's response shape stays in this file.
/// The <see cref="HttpClient"/> base address is the sports root, e.g.
/// <c>https://site.api.espn.com/apis/site/v2/sports/</c>; league keys are <c>{sport}/{league}</c>.
/// </summary>
public sealed class EspnGameFeedProvider(HttpClient http, TimeProvider clock) : IGameFeedProvider
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, ProviderCity?> _homeCities = new();

    public async Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        var scoreboard = await http.GetFromJsonAsync<Scoreboard>(
            $"{leagueKey}/scoreboard?dates={EspnDay(clock.GetUtcNow()):yyyyMMdd}", cancellationToken);

        var games = new List<ProviderGame>();
        foreach (var e in scoreboard?.Events ?? [])
        {
            if (ToGame(e, leagueKey) is not { } game)
                continue;
            // The pin falls back to the home team's city only when there's no venue, so only then is it worth asking.
            if (game.Venue is null && HomeTeamId(e) is { } teamId)
                game = game with { Home = game.Home with { HomeCity = await HomeCityAsync(leagueKey, teamId, cancellationToken) } };
            games.Add(game);
        }
        return games;
    }

    /// <summary>
    /// The scoreboard doesn't say where a team is based, so ask ESPN's team endpoint, once per team
    /// (answers are kept for the life of the provider). Prefers the franchise venue's address; teams
    /// without one (college, soccer) fall back to ESPN's "location", e.g. "Duke", which is a place
    /// name but not always a city. A failed request is not kept, so it is tried again next time.
    /// </summary>
    private async Task<ProviderCity?> HomeCityAsync(string leagueKey, string teamId, CancellationToken cancellationToken)
    {
        var key = $"{leagueKey}/teams/{teamId}";
        if (_homeCities.TryGetValue(key, out var known))
            return known;
        try
        {
            var team = (await http.GetFromJsonAsync<TeamResponse>(key, cancellationToken))?.Team;
            var address = team?.Franchise?.Venue?.Address;
            var city = !string.IsNullOrWhiteSpace(address?.City)
                ? new ProviderCity(address.City, address.State, address.Country)
                : !string.IsNullOrWhiteSpace(team?.Location) ? new ProviderCity(team.Location, null, null) : null;
            return _homeCities[key] = city;
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException
            || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return null;
        }
    }

    private static string? HomeTeamId(Event e) =>
        e.Competitions?.FirstOrDefault()?.Competitors?.FirstOrDefault(c => c.HomeAway == "home")?.Team?.Id;

    /// <summary>ESPN's scoreboard days are US Eastern calendar days.</summary>
    private static DateTime EspnDay(DateTimeOffset now) =>
        TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById("America/New_York")).Date;

    private static ProviderGame? ToGame(Event e, string leagueKey)
    {
        var competition = e.Competitions?.FirstOrDefault();
        var home = competition?.Competitors?.FirstOrDefault(c => c.HomeAway == "home");
        var away = competition?.Competitors?.FirstOrDefault(c => c.HomeAway == "away");
        if (e.Id is null || home?.Team is null || away?.Team is null)
            return null;

        var status = e.Status ?? competition!.Status;
        var started = status?.Type?.State is "in" or "post";

        return new ProviderGame(
            e.Id,
            leagueKey,
            e.Date ?? competition!.Date ?? DateTimeOffset.MinValue,
            ToTeam(home, started),
            ToTeam(away, started),
            ToStatus(status?.Type),
            started ? status?.DisplayClock : null,
            started ? status?.Period : null,
            ToVenue(competition!.Venue),
            ToBroadcasters(competition));
    }

    private static ProviderTeam ToTeam(Competitor competitor, bool started) =>
        new(competitor.Team!.Abbreviation ?? "",
            competitor.Team.DisplayName ?? competitor.Team.Abbreviation ?? "",
            competitor.Team.Logo,
            started && int.TryParse(competitor.Score, out var score) ? score : null);

    private static ProviderStatus ToStatus(StatusType? type)
    {
        var name = type?.Name ?? "";
        if (name.Contains("POSTPONED")) return ProviderStatus.Postponed;
        if (name.Contains("CANCELED") || name.Contains("CANCELLED") || name.Contains("ABANDONED")) return ProviderStatus.Canceled;
        if (name.Contains("SUSPENDED")) return ProviderStatus.Suspended;
        if (name.Contains("DELAY")) return ProviderStatus.Delayed;
        return type?.State switch
        {
            "in" => ProviderStatus.InProgress,
            "post" => ProviderStatus.Final,
            _ => ProviderStatus.Scheduled,
        };
    }

    private static ProviderVenue? ToVenue(Venue? venue) =>
        venue is null ? null : new ProviderVenue(venue.FullName, venue.Address?.City, venue.Address?.State, venue.Address?.Country);

    private static IReadOnlyList<ProviderBroadcaster> ToBroadcasters(Competition competition)
    {
        var geo = (competition.GeoBroadcasts ?? [])
            .Where(b => b.Media?.ShortName is not null && !string.Equals(b.Type?.ShortName, "Radio", StringComparison.OrdinalIgnoreCase))
            .Select(b => new ProviderBroadcaster(b.Media!.ShortName!, b.Region?.ToUpperInvariant()));
        var plain = (competition.Broadcasts ?? [])
            .SelectMany(b => b.Names ?? [])
            .Select(name => new ProviderBroadcaster(name, null));
        var broadcasters = geo.Any() ? geo : plain;
        return broadcasters.Distinct().ToList();
    }

    // ESPN response shape (only the fields ScoreMap reads).
    private sealed record Scoreboard(List<Event>? Events);
    private sealed record Event(string? Id, DateTimeOffset? Date, List<Competition>? Competitions, Status? Status);
    private sealed record Competition(DateTimeOffset? Date, Venue? Venue, List<Competitor>? Competitors, Status? Status,
        List<Broadcast>? Broadcasts, List<GeoBroadcast>? GeoBroadcasts);
    private sealed record Competitor(string? HomeAway, Team? Team, string? Score);
    private sealed record Team(string? Id, string? Abbreviation, string? DisplayName, string? Logo);
    private sealed record TeamResponse(TeamDetail? Team);
    private sealed record TeamDetail(string? Location, Franchise? Franchise);
    private sealed record Franchise(Venue? Venue);
    private sealed record Status(string? DisplayClock, int? Period, StatusType? Type);
    private sealed record StatusType(string? Name, string? State, bool? Completed);
    private sealed record Venue(string? FullName, Address? Address);
    private sealed record Address(string? City, string? State, string? Country);
    private sealed record Broadcast(string? Market, List<string>? Names);
    private sealed record GeoBroadcast(GeoBroadcastType? Type, GeoMedia? Media, string? Region);
    private sealed record GeoBroadcastType(string? ShortName);
    private sealed record GeoMedia(string? ShortName);
}
