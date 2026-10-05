using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// Reads ESPN's unofficial scoreboard endpoints (ADR-0001) and turns them into
/// provider-neutral games. All knowledge of ESPN's response shape stays in this file.
/// The <see cref="HttpClient"/> base address is the sports root, e.g.
/// <c>https://site.api.espn.com/apis/site/v2/sports/</c>; league keys are <c>{sport}/{league}</c>.
/// </summary>
public sealed partial class EspnGameFeedProvider(HttpClient http, TimeProvider clock) : IGameFeedProvider
{
    public async Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        // A league key may carry its own scoreboard options after a '?', e.g. "basketball/mens-college-basketball?groups=50".
        var (league, options) = leagueKey.Split('?', 2) switch
        {
            [var path, var query] => (path, query + "&"),
            _ => (leagueKey, ""),
        };
        // Without a limit ESPN can leave games off busy days such as a college football Saturday.
        var scoreboard = await http.GetFromJsonAsync<Scoreboard>(
            $"{league}/scoreboard?{options}dates={EspnDay(clock.GetUtcNow()):yyyyMMdd}&limit=500", cancellationToken);

        return (scoreboard?.Events ?? [])
            .Select(e => ToGame(e, leagueKey))
            .OfType<ProviderGame>()
            .ToList();
    }

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
            ToBroadcasters(competition),
            status?.Type?.State == "in" ? ToPhase(status.Type) : ProviderPeriodPhase.Playing);
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

    /// <summary>
    /// Baseball's half-inning is only given as text ("Top 7th", "Mid 7th", "Bot 7th", "End 7th"),
    /// so it is read first; other breaks come from the status name.
    /// </summary>
    private static ProviderPeriodPhase ToPhase(StatusType type)
    {
        if (InningDetail().Match(type.ShortDetail ?? "") is { Success: true } inning)
        {
            return inning.Groups[1].Value switch
            {
                "Top" => ProviderPeriodPhase.InningTop,
                "Mid" => ProviderPeriodPhase.InningMiddle,
                "Bot" => ProviderPeriodPhase.InningBottom,
                _ => ProviderPeriodPhase.InningEnd,
            };
        }

        var name = type.Name ?? "";
        if (name.Contains("SHOOTOUT")) return ProviderPeriodPhase.Shootout;
        if (name.Contains("HALFTIME") || name.Contains("END_PERIOD") || name.Contains("END_OF_")) return ProviderPeriodPhase.Break;
        return ProviderPeriodPhase.Playing;
    }

    [GeneratedRegex(@"^(Top|Mid|Bot|End) \d+(st|nd|rd|th)$")]
    private static partial Regex InningDetail();

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
    private sealed record Team(string? Abbreviation, string? DisplayName, string? Logo);
    private sealed record Status(string? DisplayClock, int? Period, StatusType? Type);
    private sealed record StatusType(string? Name, string? State, bool? Completed, string? ShortDetail);
    private sealed record Venue(string? FullName, Address? Address);
    private sealed record Address(string? City, string? State, string? Country);
    private sealed record Broadcast(string? Market, List<string>? Names);
    private sealed record GeoBroadcast(GeoBroadcastType? Type, GeoMedia? Media, string? Region);
    private sealed record GeoBroadcastType(string? ShortName);
    private sealed record GeoMedia(string? ShortName);
}
