using System.Text.RegularExpressions;

namespace ScoreMap.Server.Tests.Conventions;

/// <summary>
/// Ratchets sleeps in server tests: wait for the work, rather than guessing how long it takes.
/// Use PlacedGameAsync / PlacedGamesAsync in Support/ScoreMapServer.cs for venue placement,
/// GameMatchingAsync / GamesMatchingAsync there for delivered game state (#261), and wait for
/// SlowStartClock.DelayScheduled in Scenarios/ScenarioSlowStartTests.cs before advancing fake time
/// (the timer-registration barrier from fa89ba2). Support fakes may deliberately delay.
/// </summary>
public partial class TestWaitConventionTests
{
    private static readonly Dictionary<string, int> AllowedSleeps = new()
    {
        ["tests/ScoreMap.Server.Tests/Live/PollingTests.cs"] = 1,
        ["tests/ScoreMap.Server.Tests/Scenarios/DemoTests.cs"] = 2,
        ["tests/ScoreMap.Server.Tests/Scenarios/ScenarioSpeedTests.cs"] = 8,
        ["tests/ScoreMap.Server.Tests/Scenarios/ScenarioSwitchingTests.cs"] = 3,
        ["tests/ScoreMap.Server.Tests/Scenarios/ScenarioTests.cs"] = 2,
        ["tests/ScoreMap.Server.Tests/SnapshotTests.cs"] = 1,
        ["tests/ScoreMap.Server.Tests/Venues/NominatimPlaceSearchTests.cs"] = 2,
    };

    [Fact]
    public void Server_tests_do_not_add_sleeps_and_removed_sleeps_lower_the_allowance()
    {
        var counts = SourceFiles()
            .ToDictionary(Relative, file => Sleep().Matches(File.ReadAllText(file)).Count);
        var offenders = new List<string>();
        foreach (var file in counts.Keys.Union(AllowedSleeps.Keys).Order())
        {
            var count = counts.GetValueOrDefault(file);
            var allowance = AllowedSleeps.GetValueOrDefault(file);
            if (count > allowance)
                offenders.Add($"{file}: {count} sleeps, allowance {allowance}; remove the new sleep(s).");
            else if (count < allowance)
                offenders.Add($"{file}: {count} sleeps, allowance {allowance}; lower the allowance (remove the entry at zero).");
        }

        Assert.True(offenders.Count == 0,
            "Do not add sleeps to server tests. Wait for venue placement with PlacedGameAsync / PlacedGamesAsync, "
            + "or delivered game state with GameMatchingAsync / GamesMatchingAsync (#261), in Support/ScoreMapServer.cs. "
            + "For fake-clock tests, await the timer-registration barrier before advancing time: "
            + "SlowStartClock.DelayScheduled in Scenarios/ScenarioSlowStartTests.cs (fa89ba2). "
            + "When a sleep is removed, lower the allowance; do not increase it. Offenders:\n"
            + string.Join("\n", offenders));
    }

    [GeneratedRegex(@"\b(?:Task\s*\.\s*Delay|Thread\s*\.\s*Sleep)\s*\(")]
    private static partial Regex Sleep();

    private static readonly string ServerFolder = FindServerFolder();

    private static string FindServerFolder()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "ScoreMap.slnx")))
                return dir.FullName;
        throw new InvalidOperationException("ScoreMap.slnx not found above " + AppContext.BaseDirectory);
    }

    private static IEnumerable<string> SourceFiles() =>
        Directory.EnumerateFiles(Path.Combine(ServerFolder, "tests"), "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(p => p is "bin" or "obj"))
            .Where(f => !Relative(f).StartsWith("tests/ScoreMap.Server.Tests/Support/", StringComparison.Ordinal));

    private static string Relative(string file) => Path.GetRelativePath(ServerFolder, file).Replace('\\', '/');
}
