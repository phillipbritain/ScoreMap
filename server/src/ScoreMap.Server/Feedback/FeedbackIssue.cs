using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Feedback;

/// <summary>
/// What the viewer's browser says about what they were looking at, sent with their feedback. Only
/// what the server can check reaches the issue: the screen's size, a game on the board, configured leagues.
/// </summary>
public sealed record FeedbackContext(
    int ScreenWidth = 0,
    int ScreenHeight = 0,
    bool PhoneLayout = false,
    string? GameId = null,
    IReadOnlyList<string>? Leagues = null,
    bool TopEventsOnly = false);

/// <summary>
/// Feedback as the issue it's filed as: titled with the start of the viewer's text, the text fenced
/// off so it can't mention anyone, link an issue or break the layout, then a Context section. Nothing
/// in the issue outside the fence is the viewer's own words, and nothing says where they are.
/// </summary>
public sealed partial record FeedbackIssue(string Title, string Body)
{
    public const int MinLength = 10;
    public const int MaxLength = 2000;
    private const int TitleLength = 60;

    /// <summary>The app's version: the commit it was built from, or the assembly's version without one.</summary>
    public static string AppVersion { get; } = ReadAppVersion();

    /// <summary>
    /// The issue for the viewer's feedback: <paramref name="text"/>, trimmed, between
    /// <see cref="MinLength"/> and <see cref="MaxLength"/> characters.
    /// </summary>
    public static FeedbackIssue Write(string text, FeedbackContext context, string? userAgent,
        IReadOnlyList<League> leagues, IReadOnlyList<Game> games)
    {
        var body = new StringBuilder();
        // Longer than any run of backticks in the text, so nothing in it can close the fence.
        var fence = new string('`', Math.Max(3, LongestBacktickRun(text) + 1));
        body.Append($"{fence}text\n{text.ReplaceLineEndings("\n")}\n{fence}\n\n### Context\n\n");
        body.Append($"- **Version:** {AppVersion}\n");
        if (context.ScreenWidth > 0 && context.ScreenHeight > 0)
            body.Append($"- **Screen:** {context.ScreenWidth} × {context.ScreenHeight}, {(context.PhoneLayout ? "phone" : "wide")} layout\n");
        body.Append($"- **Browser:** {BrowserOf(userAgent)}\n");
        if (games.FirstOrDefault(g => g.Id == context.GameId) is { } game)
            body.Append($"- **Open game:** {game.League}, ESPN game {game.Id}\n");
        if (LeaguesShowing(context, leagues) is { } showing)
            body.Append($"- **Leagues showing:** {showing}\n");
        return new FeedbackIssue(TitleOf(text), body.ToString());
    }

    /// <summary>
    /// The text's start on one line, cut at a word near <see cref="TitleLength"/> characters. A word
    /// joiner after each @ and # keeps GitHub from reading a mention or an issue link in it.
    /// </summary>
    private static string TitleOf(string text)
    {
        var line = Whitespace().Replace(text, " ").Trim();
        if (line.Length > TitleLength)
        {
            var cut = line.LastIndexOf(' ', TitleLength);
            line = line[..(cut > TitleLength / 2 ? cut : TitleLength)].TrimEnd() + "…";
        }
        return line.Replace("@", "@⁠").Replace("#", "#⁠");
    }

    private static int LongestBacktickRun(string text) =>
        BacktickRuns().Matches(text).Select(m => m.Length).DefaultIfEmpty(0).Max();

    /// <summary>
    /// The leagues the viewer had on, in the configured order: only configured ones, so nothing the
    /// browser made up gets in.
    /// </summary>
    private static string? LeaguesShowing(FeedbackContext context, IReadOnlyList<League> leagues)
    {
        if (context.TopEventsOnly)
            return "Top Events only";
        if (context.Leagues is not { } sent)
            return null;
        var on = leagues.Where(l => sent.Contains(l.Name)).Select(l => l.Name).ToList();
        if (on.Count == 0)
            return "None";
        return on.Count == leagues.Count ? "All leagues" : string.Join(", ", on);
    }

    private static readonly (Regex Pattern, string Name)[] Browsers =
    [
        (BrowserVersion("Edg(?:e|A|iOS)?"), "Edge"),
        (BrowserVersion("OPR"), "Opera"),
        (BrowserVersion("SamsungBrowser"), "Samsung Internet"),
        (BrowserVersion("(?:Firefox|FxiOS)"), "Firefox"),
        (BrowserVersion("(?:Chrome|CriOS)"), "Chrome"),
        (new Regex(@"Version/(?<version>\d+)[^ ]* (?:Mobile/\S+ )?Safari/"), "Safari"),
    ];

    private static readonly (string Marker, string Name)[] OperatingSystems =
    [
        ("iPhone", "iOS"), ("iPad", "iOS"), ("Android", "Android"), ("CrOS", "ChromeOS"),
        ("Windows", "Windows"), ("Macintosh", "macOS"), ("Linux", "Linux"),
    ];

    /// <summary>
    /// The browser, its major version and the OS, by name from the user agent: only names from these
    /// lists and a number, so nothing else in the user agent reaches the issue.
    /// </summary>
    private static string BrowserOf(string? userAgent)
    {
        if (string.IsNullOrEmpty(userAgent))
            return "Unknown";
        var browser = Browsers
            .Select(b => (Match: b.Pattern.Match(userAgent), b.Name))
            .Where(b => b.Match.Success)
            .Select(b => $"{b.Name} {b.Match.Groups["version"].Value}")
            .FirstOrDefault();
        var os = OperatingSystems.FirstOrDefault(o => userAgent.Contains(o.Marker, StringComparison.Ordinal)).Name;
        return (browser, os) switch
        {
            (null, null) => "Unknown",
            (null, _) => $"Unknown browser on {os}",
            (_, null) => browser,
            _ => $"{browser} on {os}",
        };
    }

    private static Regex BrowserVersion(string token) => new($@"\b{token}/(?<version>\d+)");

    private static string ReadAppVersion()
    {
        var version = typeof(FeedbackIssue).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
        // The SDK adds the commit after a +, as "1.0.0+<sha>".
        var plus = version.IndexOf('+');
        return plus < 0 ? version : version[(plus + 1)..][..Math.Min(7, version.Length - plus - 1)];
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex("`+")]
    private static partial Regex BacktickRuns();
}
