using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Sports;

namespace ScoreMap.Server.Tests.Sports;

public sealed class SupportedSportTests
{
    public static IEnumerable<object[]> EverySport() => Enum.GetValues<Sport>().Select(sport => new object[] { sport });

    [Theory]
    [MemberData(nameof(EverySport))]
    public void Every_supported_sport_has_live_rules_and_a_scenario_entry(Sport sport)
    {
        var league = new League { Key = "sample", Name = "Sample", Sport = sport };
        var rules = SportRules.For(sport);
        var scenario = ScenarioSports.For(league);

        Assert.False(string.IsNullOrWhiteSpace(rules.Name));
        Assert.True(rules.Usual.RegulationPeriods > 0);
        Assert.NotNull(scenario.CreatePlay());
        Assert.Empty(scenario.CreateDetails().Fill([]));
    }

    [Fact]
    public void An_unknown_sport_cannot_silently_borrow_another_sports_rules()
    {
        var unknown = (Sport)int.MaxValue;
        var league = new League { Key = "unknown", Name = "Unknown", Sport = unknown };
        Assert.Throws<ArgumentOutOfRangeException>(() => SportRules.For(unknown));
        Assert.Throws<ArgumentOutOfRangeException>(() => ScenarioSports.For(league));
    }

    [Theory]
    [MemberData(nameof(EverySport))]
    public void Fight_card_rules_apply_before_the_configured_sport(Sport sport)
    {
        var league = new League { Key = "sample", Name = "Sample", Sport = sport };
        var main = new ProviderBout("main", new("First", "First", null, null), new("Second", "Second", null, null),
            null, 3, ProviderStatus.InProgress, 3, "4:59");
        var game = new ProviderGame("card", league.Key, DateTimeOffset.UnixEpoch, new ProviderBouts([main]),
            ProviderStatus.InProgress, null, null, null, []);

        Assert.Equal("R3", ClockLine.For(game, league));
        Assert.True(HotGame.For(game, league));
        var final = game with { Status = ProviderStatus.Final, Contest = new ProviderBouts([
            main with { Status = ProviderStatus.Final, Method = BoutMethod.KnockOut }]) };
        Assert.Equal("KO/TKO · R3", ClockLine.For(final, league));
        Assert.False(HotGame.For(final, league));
    }
}
