using System.Text.RegularExpressions;

namespace ScoreMap.Server.Tests.Conventions;

/// <summary>
/// Scans the server's source for catches that decide "was this a cancellation?" by exception type alone.
/// HttpClient reports a timeout as a TaskCanceledException, which is an OperationCanceledException, so
/// judging by type treats a timeout as a cancellation (#24: one ESPN timeout stopped the server). Decide
/// by the cancellation token instead: <c>catch (Exception e) when (!cancellationToken.IsCancellationRequested)</c>,
/// or <c>catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)</c>.
/// </summary>
public partial class CancellationConventionTests
{
    [Fact]
    public void No_catch_excludes_cancellations_by_exception_type()
    {
        var offenders = SourceFiles()
            .SelectMany(file => Lines(file).Where(l => ExcludesByType().IsMatch(l.Text)))
            .Select(l => l.Where)
            .ToList();

        Assert.True(offenders.Count == 0,
            "Filter on the cancellation token, not `is not OperationCanceledException` (an HttpClient timeout is one too):\n"
            + string.Join("\n", offenders));
    }

    [Fact]
    public void Every_catch_of_a_cancellation_checks_the_token()
    {
        var offenders = new List<string>();
        foreach (var file in SourceFiles())
        {
            var text = File.ReadAllText(file);
            foreach (Match match in CatchOfCancellation().Matches(text))
            {
                // The filter runs from the catch's closing parenthesis to the block's opening brace,
                // so a `when` wrapped onto the next line still counts.
                var end = text.IndexOf('{', match.Index + match.Length);
                var filter = text[(match.Index + match.Length)..(end < 0 ? text.Length : end)];
                if (!TokenFilter().IsMatch(filter))
                    offenders.Add($"{Relative(file)}:{LineOf(text, match.Index)}");
            }
        }

        Assert.True(offenders.Count == 0,
            "Catch a cancellation only `when (...IsCancellationRequested)`, so an HttpClient timeout isn't mistaken for one:\n"
            + string.Join("\n", offenders));
    }

    [GeneratedRegex(@"is\s+not\s+(System\.)?(Operation|Task)CanceledException\b")]
    private static partial Regex ExcludesByType();

    [GeneratedRegex(@"catch\s*\(\s*(System\.)?(Operation|Task)CanceledException\b[^)]*\)")]
    private static partial Regex CatchOfCancellation();

    [GeneratedRegex(@"^\s*when\s*\([\s\S]*IsCancellationRequested")]
    private static partial Regex TokenFilter();

    private static readonly string ServerFolder = FindServerFolder();

    /// <summary>The server folder (holding ScoreMap.slnx), found by walking up from the test binaries.</summary>
    private static string FindServerFolder()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "ScoreMap.slnx")))
                return dir.FullName;
        throw new InvalidOperationException("ScoreMap.slnx not found above " + AppContext.BaseDirectory);
    }

    private static IEnumerable<string> SourceFiles() =>
        Directory.EnumerateFiles(Path.Combine(ServerFolder, "src"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(p => p is "bin" or "obj"));

    private static IEnumerable<(string Text, string Where)> Lines(string file) =>
        File.ReadLines(file).Select((text, i) => (text, $"{Relative(file)}:{i + 1}"));

    private static string Relative(string file) => Path.GetRelativePath(ServerFolder, file).Replace('\\', '/');

    private static int LineOf(string text, int index) => text.AsSpan(0, index).Count('\n') + 1;
}
