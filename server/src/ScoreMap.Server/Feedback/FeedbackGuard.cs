using System.Net;
using System.Security.Cryptography;

namespace ScoreMap.Server.Feedback;

/// <summary>
/// The limits on feedback: a few submissions per visitor in a while, and a cap on issues a day across
/// all visitors. A visitor is told apart by their IP address, kept only as a keyed hash in memory for as
/// long as the limit needs it: never stored or posted.
/// </summary>
public sealed class FeedbackGuard(TimeProvider clock)
{
    public const int PerVisitorLimit = 3;
    public static readonly TimeSpan PerVisitorWindow = TimeSpan.FromMinutes(10);
    public const int DailyCap = 20;

    // A fresh key each time the server starts, so the hashes can't be matched to addresses.
    private readonly byte[] _key = RandomNumberGenerator.GetBytes(32);
    private readonly Dictionary<string, Queue<DateTimeOffset>> _sends = new();
    private DateOnly _today;
    private int _filedToday;

    /// <summary>Counts a submission from the visitor, unless they've already sent as many as they may for now.</summary>
    public bool TrySend(IPAddress? visitor)
    {
        var now = clock.GetUtcNow();
        var key = KeyOf(visitor);
        lock (_sends)
        {
            foreach (var (other, times) in _sends.ToList())
            {
                while (times.TryPeek(out var sent) && now - sent >= PerVisitorWindow)
                    times.Dequeue();
                if (times.Count == 0)
                    _sends.Remove(other);
            }
            if (!_sends.TryGetValue(key, out var sends))
                _sends[key] = sends = new Queue<DateTimeOffset>();
            if (sends.Count >= PerVisitorLimit)
                return false;
            sends.Enqueue(now);
            return true;
        }
    }

    /// <summary>Gives back the visitor's last submission, which wasn't filed after all.</summary>
    public void GiveBackSend(IPAddress? visitor)
    {
        lock (_sends)
        {
            if (!_sends.TryGetValue(KeyOf(visitor), out var sends) || sends.Count == 0)
                return;
            // Their latest, which is the queue's last.
            var kept = sends.Take(sends.Count - 1).ToList();
            sends.Clear();
            foreach (var sent in kept)
                sends.Enqueue(sent);
        }
    }

    private string KeyOf(IPAddress? visitor) =>
        Convert.ToHexString(HMACSHA256.HashData(_key, (visitor ?? IPAddress.None).GetAddressBytes()));

    /// <summary>Takes one of today's issues (in UTC days), unless they've all been filed.</summary>
    public bool TryTakeToday()
    {
        lock (_sends)
        {
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            if (today != _today)
                (_today, _filedToday) = (today, 0);
            if (_filedToday >= DailyCap)
                return false;
            _filedToday++;
            return true;
        }
    }

    /// <summary>Gives back an issue taken today that wasn't filed after all.</summary>
    public void GiveBackToday()
    {
        lock (_sends)
            _filedToday = Math.Max(0, _filedToday - 1);
    }
}
