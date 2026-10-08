namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The scenario clock (ADR-0009): the time a running scenario's games are on. It reads the real time
/// when the scenario starts, then runs at <see cref="Speed"/>, one of <see cref="Speeds"/>. A change of
/// speed carries on from the clock's reading. Only <see cref="GetUtcNow"/> runs at the speed: timers and
/// timestamps stay on the real clock, as nothing should wait on scenario time.
/// </summary>
public sealed class ScenarioClock : TimeProvider
{
    /// <summary>The speeds to choose from, slowest first; 1× is real time.</summary>
    public static readonly IReadOnlyList<int> Speeds = [1, 2, 4, 8, 16, 32, 64];

    private readonly TimeProvider _realTime;
    private readonly Lock _lock = new();
    private ClockAnchor _anchor;
    private int _speed;

    public ScenarioClock(TimeProvider realTime, int speed)
    {
        _realTime = realTime;
        _speed = CheckSpeed(speed);
        _anchor = ClockAnchor.RealTime(realTime);
    }

    /// <summary>How many times faster than real time the clock runs.</summary>
    public int Speed
    {
        get
        {
            lock (_lock)
                return _speed;
        }
    }

    /// <summary>The clock's reading now, and the real time now: from these and the speed, its reading at any time.</summary>
    public ClockAnchor Anchor
    {
        get
        {
            lock (_lock)
                return AnchorNow();
        }
    }

    public override DateTimeOffset GetUtcNow() => Anchor.Reads;

    /// <summary>Sets the clock to the real time, for a scenario starting, keeping the speed.</summary>
    public void Restart()
    {
        lock (_lock)
            _anchor = ClockAnchor.RealTime(_realTime);
    }

    /// <summary>Runs the clock at <paramref name="speed"/> from its reading now. Throws for a speed not in <see cref="Speeds"/>.</summary>
    public void ChangeSpeed(int speed)
    {
        CheckSpeed(speed);
        lock (_lock)
        {
            _anchor = AnchorNow();
            _speed = speed;
        }
    }

    /// <summary>Whether <paramref name="speed"/> is one of <see cref="Speeds"/>.</summary>
    public static bool IsSpeed(int speed) => Speeds.Contains(speed);

    /// <summary>The speeds as a message lists them: "1, 2, 4, …".</summary>
    public static string SpeedList => string.Join(", ", Speeds);

    private ClockAnchor AnchorNow()
    {
        var now = _realTime.GetUtcNow();
        return new ClockAnchor(now, _anchor.Reads + (now - _anchor.At) * _speed);
    }

    private static int CheckSpeed(int speed) => IsSpeed(speed)
        ? speed
        : throw new ArgumentOutOfRangeException(nameof(speed), speed, $"The scenario speed must be one of {SpeedList}");
}

/// <summary>What a clock <see cref="Reads"/> at the real time <see cref="At"/>.</summary>
public sealed record ClockAnchor(DateTimeOffset At, DateTimeOffset Reads)
{
    /// <summary>A clock reading the real time now.</summary>
    public static ClockAnchor RealTime(TimeProvider realTime)
    {
        var now = realTime.GetUtcNow();
        return new ClockAnchor(now, now);
    }
}
