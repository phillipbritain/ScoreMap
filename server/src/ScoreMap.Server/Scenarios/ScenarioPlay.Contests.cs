using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public sealed partial class ScenarioPlay
{
    private const int RaceLaps = 200;

    private void PlayContest(PlayedGame played, DateTimeOffset at)
    {
        var before = played.Through;
        played.Through = Math.Min(1, before + Step / played.League.PlannedLength);
        var game = played.Game with { Status = ProviderStatus.InProgress };
        if (game.Contest is ProviderField field)
        {
            var golf = played.League.Sport == Sport.Golf;
            var entries = field.Entries.ToList();
            var phase = ProviderPeriodPhase.Playing;
            if (golf)
            {
                // Each day is half play, half night; the last day finishes at its last hole.
                var day = Math.Min(3, (int)(played.Through * 4));
                var within = played.Through * 4 - day;
                var holes = Math.Min(18, (int)(within * 36));
                var oldDay = Math.Min(3, (int)(before * 4));
                var oldHoles = Math.Min(18, (int)((before * 4 - oldDay) * 36));
                if (holes != oldHoles || day != oldDay)
                    entries = entries.Select(e => e with { ToPar = (e.ToPar ?? 0) + _random.Next(-1, 2), Thru = holes }).ToList();
                entries = entries.OrderBy(e => e.ToPar).ToList();
                phase = holes == 18 && day < 3 ? ProviderPeriodPhase.Break : ProviderPeriodPhase.Playing;
                game = game with { Period = day + 1 };
            }
            else
            {
                var previousLap = (int)(before * RaceLaps);
                var lap = (int)(played.Through * RaceLaps);
                if (lap != previousLap && entries.Count > 1 && _random.NextDouble() < 0.4)
                {
                    var index = _random.Next(entries.Count - 1);
                    (entries[index], entries[index + 1]) = (entries[index + 1], entries[index]);
                }
                game = game with { Period = Math.Min(RaceLaps, lap + 1) };
            }
            if (golf && played.Through >= 0.875)
                played.Through = 1;
            game = game with { Contest = ProviderField.TiedByScore(entries), Phase = phase, DisplayClock = null };
        }
        else if (game.Contest is ProviderBouts card)
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
                var ends = seconds >= 300 && round >= bout.ScheduledRounds || _random.NextDouble() < 1.0 / 1800;
                if (ends)
                {
                    var firstWins = _random.Next(2) == 0;
                    bout = bout with { Status = ProviderStatus.Final, Round = round,
                        Clock = $"{(int)seconds / 60}:{(int)seconds % 60:00}",
                        First = bout.First with { Winner = firstWins }, Second = bout.Second with { Winner = !firstWins },
                        Method = seconds >= 300 && round >= bout.ScheduledRounds ? BoutMethod.Decision
                            : _random.Next(2) == 0 ? BoutMethod.KnockOut : BoutMethod.Submission };
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
            game = game with { Contest = updated, Status = updated.Status(), Period = null, DisplayClock = null };
        }
        if (game.Contest is ProviderField && played.Through >= 1)
            game = game with { Status = ProviderStatus.Final, Phase = ProviderPeriodPhase.Playing };
        if (game.Status == ProviderStatus.Final)
            played.StoppedAt = at;
        played.Game = game;
    }
}
