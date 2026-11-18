using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.GameFeed;

public sealed partial class EspnGameFeedProvider
{
    // Summary payloads are large. Share one lookup per event across viewers and limit total
    // concurrency. A viewer closing the panel stops waiting without canceling other viewers' lookup.
    private static readonly TimeSpan DetailsLifetime = TimeSpan.FromSeconds(20);
    private readonly MemoryCache _detailsCache = new(new MemoryCacheOptions { SizeLimit = 512 });
    private readonly SemaphoreSlim _summarySlots = new(4);
    private readonly ConcurrentDictionary<(string League, string Game), Lazy<Task<GameDetails?>>> _summaryWork = new();

    public async Task<GameDetails?> FetchGameDetailsAsync(League league, string id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // ESPN gives tennis match IDs inside tournament summaries. They are not summary event IDs.
        if (league.Sport == Sport.Tennis || !id.All(char.IsAsciiDigit) || id.Length == 0)
            return GameDetails.Empty;
        var key = (league.Key.Split('?')[0], id);
        if (_detailsCache.TryGetValue<GameDetails?>(key, out var cached))
            return cached;

        var lookup = _summaryWork.GetOrAdd(key, _ => new Lazy<Task<GameDetails?>>(() => LoadDetailsAsync(league, key)));
        return await lookup.Value.WaitAsync(cancellationToken);
    }

    private async Task<GameDetails?> LoadDetailsAsync(League league, (string League, string Game) key)
    {
        try
        {
            // Another request may have completed between the cache read and publishing this task.
            if (_detailsCache.TryGetValue<GameDetails?>(key, out var cached))
                return cached;

            await _summarySlots.WaitAsync();
            GameDetails? details;
            try
            {
                var summary = await http.GetFromJsonAsync<Summary>($"{key.League}/summary?event={key.Game}");
                details = summary is null ? null : ToGameDetails(summary, league);
            }
            catch (Exception error) when (error is HttpRequestException or JsonException or OperationCanceledException)
            {
                details = null;
            }
            finally
            {
                _summarySlots.Release();
            }

            _detailsCache.Set(key, details, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = DetailsLifetime,
                Size = 1,
            });
            return details;
        }
        finally
        {
            _summaryWork.TryRemove(key, out _);
        }
    }

    private static GameDetails ToGameDetails(Summary summary, League league)
    {
        var competition = summary.Header?.Competitions?.FirstOrDefault();
        var competitors = competition?.Competitors ?? [];
        var home = competitors.Find(team => team.HomeAway == "home");
        var away = competitors.Find(team => team.HomeAway == "away");
        var plays = summary.ScoringPlays is { Count: > 0 } scoring
            ? scoring
            : summary.Plays?.Where(play => play.ScoringPlay == true).ToList() ?? [];
        var drives = summary.Drives?.Previous ?? [];
        if (summary.Drives?.Current is { } current && !drives.Any(drive => drive.Id == current.Id))
            drives = [.. drives, current];

        return new GameDetails(
            PeriodScores(league, home?.Linescores ?? [], away?.Linescores ?? []), home?.Score, away?.Score,
            plays.Select(play => ToScoringPlay(play, competitors) is { } score
                ? new GameScoringPlay(score.Team, score.Text, ClockLine.When(score, league), play.HomeScore, play.AwayScore)
                : null).OfType<GameScoringPlay>().ToList(),
            league.Sport == Sport.Football ? drives.Where(drive => !string.IsNullOrWhiteSpace(drive.Team?.Abbreviation))
                .Select(drive => new GameDrive(drive.Team!.Abbreviation!, drive.DisplayResult, drive.IsScore == true,
                    drive.OffensivePlays, drive.Yards, drive.TimeElapsed?.DisplayValue, drive.Start?.Text, drive.End?.Text)).ToList() : [],
            ToPlayerStats(summary.Boxscore),
            (summary.Videos ?? []).Where(video => !string.IsNullOrWhiteSpace(video.Headline) && IsEspnVideo(VideoUrl(video)))
                .Select(video => new GameVideo(video.Headline!, VideoUrl(video)!, video.Duration))
                .DistinctBy(video => video.Url).ToList(),
            (competition?.Broadcasts ?? []).Concat(summary.Broadcasts ?? [])
                .Where(broadcast => !string.Equals(broadcast.Type?.ShortName, "Radio", StringComparison.OrdinalIgnoreCase))
                .Select(broadcast => broadcast.Media?.ShortName ?? broadcast.Name)
                .OfType<string>().Where(name => !string.IsNullOrWhiteSpace(name)).Distinct(StringComparer.OrdinalIgnoreCase).ToList());
    }

    private static List<GamePeriodScore> PeriodScores(League league, List<SummaryLinescore> home, List<SummaryLinescore> away)
    {
        var periodCount = Math.Max(home.Count, away.Count);
        if (periodCount == 0 || league.Sport is not (Sport.Football or Sport.Basketball or Sport.Hockey or Sport.Baseball))
            return [];

        return Enumerable.Range(1, Math.Max(periodCount, league.Regulation)).Select(period => new GamePeriodScore(
            league.Sport switch
            {
                Sport.Baseball => period.ToString(),
                _ when period > league.Regulation => period == league.Regulation + 1 ? "OT" : $"OT{period - league.Regulation}",
                Sport.Hockey => $"P{period}",
                Sport.Basketball when league.Regulation == 2 => $"H{period}",
                _ => $"Q{period}",
            },
            home.ElementAtOrDefault(period - 1)?.DisplayValue, away.ElementAtOrDefault(period - 1)?.DisplayValue)).ToList();
    }

    private static List<GameStatTeam> ToPlayerStats(SummaryBoxscore? boxscore)
    {
        var teams = new List<GameStatTeam>();
        foreach (var group in boxscore?.Players ?? [])
        {
            if (group.Team?.Abbreviation is not { Length: > 0 } team)
                continue;
            var sections = new List<GameStatSection>();
            foreach (var category in group.Statistics ?? [])
            {
                if (category.Labels is not { Count: > 0 } columns || (category.Text ?? category.Name) is not { Length: > 0 } name)
                    continue;
                var players = (category.Athletes ?? []).Where(player => player.Athlete?.DisplayName is { Length: > 0 } &&
                    player.Stats?.Count == columns.Count)
                    .Select(player => new GameStatPlayer(player.Athlete!.DisplayName!, player.Stats!)).ToList();
                if (players.Count > 0)
                    sections.Add(new GameStatSection(name, columns, players));
            }
            if (sections.Count > 0)
                teams.Add(new GameStatTeam(team, sections));
        }
        return teams;
    }

    private static string? VideoUrl(SummaryVideo video) => video.Links?.Web?.Href ?? video.Links?.Web?.Self?.Href;

    private static bool IsEspnVideo(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var url)
        && url.Scheme == Uri.UriSchemeHttps && url.Host is "www.espn.com" or "espn.com";

    private sealed record Summary(SummaryHeader? Header, List<Play>? ScoringPlays, List<Play>? Plays,
        SummaryDrives? Drives, SummaryBoxscore? Boxscore, List<SummaryVideo>? Videos, List<SummaryBroadcast>? Broadcasts);
    private sealed record SummaryHeader(List<SummaryCompetition>? Competitions);
    private sealed record SummaryCompetition(List<SummaryCompetitor>? Competitors, List<SummaryBroadcast>? Broadcasts);
    private sealed record SummaryCompetitor(string? Id, Team? Team, string? HomeAway, string? Score, List<SummaryLinescore>? Linescores);
    private sealed record SummaryLinescore(string? DisplayValue);
    private sealed record SummaryBroadcast(SummaryName? Type, SummaryName? Media, string? Name);
    private sealed record SummaryName(string? ShortName);
    private sealed record SummaryDrives(List<SummaryDrive>? Previous, SummaryDrive? Current);
    private sealed record SummaryDrive(string? Id, Team? Team, string? DisplayResult, bool? IsScore,
        int? OffensivePlays, int? Yards, Clock? TimeElapsed, SummaryFieldPosition? Start, SummaryFieldPosition? End);
    private sealed record SummaryFieldPosition(string? Text);
    private sealed record SummaryBoxscore(List<SummaryStatTeam>? Players);
    private sealed record SummaryStatTeam(Team? Team, List<SummaryStatSection>? Statistics);
    private sealed record SummaryStatSection(string? Name, string? Text, List<string>? Labels, List<SummaryStatPlayer>? Athletes);
    private sealed record SummaryStatPlayer(Athlete? Athlete, List<string>? Stats);
    private sealed record SummaryVideo(string? Headline, int? Duration, SummaryVideoLinks? Links);
    private sealed record SummaryVideoLinks(SummaryWebLink? Web);
    private sealed record SummaryWebLink(string? Href, Link? Self);
}
