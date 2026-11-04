using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class MmaScenario
{
    internal static ProviderGame AdvanceCard(ProviderGame game, ProviderBouts card, Random random)
    {
        var bouts = card.Bouts.ToList();
        var index = bouts.FindLastIndex(b => b.Status is ProviderStatus.Scheduled or ProviderStatus.InProgress);
        if (index >= 0)
        {
            var bout = bouts[index];
            var seconds = TimeSpan.TryParseExact(bout.Clock, @"m\:ss", null, out var clock) ? clock.TotalSeconds : 0;
            seconds++;
            var round = bout.Round ?? 1;
            // A bout can end early, or reach the judges (and the main event's last round).
            var ends = seconds >= 300 && round >= bout.ScheduledRounds || random.NextDouble() < 1.0 / 1800;
            if (ends)
            {
                var firstWins = random.Next(2) == 0;
                bout = bout with { Status = ProviderStatus.Final, Round = round,
                Clock = $"{(int)seconds / 60}:{(int)seconds % 60:00}",
                First = bout.First with { Winner = firstWins }, Second = bout.Second with { Winner = !firstWins },
                Method = seconds >= 300 && round >= bout.ScheduledRounds ? BoutMethod.Decision
                    : random.Next(2) == 0 ? BoutMethod.KnockOut : BoutMethod.Submission };
            }
            else
            {
                if (seconds >= 300) { round++; seconds = 0; }
                bout = bout with { Status = ProviderStatus.InProgress, Round = round,
                Clock = $"{(int)seconds / 60}:{(int)seconds % 60:00}" };
            }
            bouts[index] = bout;
        }
        var updated = new ProviderBouts(bouts);
        return game with { Contest = updated, Status = updated.Status(), Period = null, DisplayClock = null };
    }

    internal static ProviderBouts ResetCard(ProviderBouts card, string replacementId) =>
        new(card.Bouts.Select((b, i) => b with { Id = $"{replacementId}-bout-{i + 1}", Status = ProviderStatus.Scheduled,
            Round = null, Clock = null, Method = null, First = b.First with { Winner = false },
            Second = b.Second with { Winner = false } }).ToList());
}
