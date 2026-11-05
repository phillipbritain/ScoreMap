using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

/// <summary>
/// Play for a fight card, whatever its sport: its bouts are fought one at a time, a second at a time
/// through five-minute rounds, each ending early or with the judges after its last round.
/// </summary>
internal sealed class FightCardPlay : GamePlay
{
    internal static readonly FightCardPlay Instance = new();

    internal override Played TakeOn(ProviderGame game, double sinceStart) => new(game, Math.Clamp(sinceStart, 0, 1));

    internal override Played Start(ProviderGame game, double step, Random random) => Step(game, 0, step, random);

    internal override Played Step(ProviderGame game, double through, double step, Random random)
    {
        game = game with { Status = ProviderStatus.InProgress };
        return new(Advance(game, (ProviderBouts)game.Contest, random), Math.Min(1, through + step));
    }

    private static ProviderGame Advance(ProviderGame game, ProviderBouts card, Random random)
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

    /// <summary>The card to be fought again, as a new game with id <paramref name="replacementId"/>.</summary>
    internal ProviderBouts Reset(ProviderBouts card, string replacementId) =>
        new(card.Bouts.Select((b, i) => b with { Id = $"{replacementId}-bout-{i + 1}", Status = ProviderStatus.Scheduled,
            Round = null, Clock = null, Method = null, First = b.First with { Winner = false },
            Second = b.Second with { Winner = false } }).ToList());
}
