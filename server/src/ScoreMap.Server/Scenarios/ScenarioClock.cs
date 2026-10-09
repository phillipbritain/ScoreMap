namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The scenario clock (ADR-0009): the time a running scenario's games are on. It reads the real time
/// when the scenario starts, then runs at <see cref="Speed"/>. A change of speed carries on from the
/// clock's reading. Only <see cref="GetUtcNow"/> runs at the speed: timers and
/// timestamps stay on the real clock, as nothing should wait on scenario time.
/// </summary>
public sealed class ScenarioClock : TimeProvider
{
    private readonly TimeProvider _realTime;
    private readonly Lock _lock = new();
    private ClockAnchor _anchor;
    private Speed _speed;

    public ScenarioClock(TimeProvider realTime, Speed speed)
    {
        _realTime = realTime;
        _speed = speed;
        _anchor = ClockAnchor.RealTime(realTime);
    }

    /// <summary>How fast the clock runs.</summary>
    public Speed Speed
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

    /// <summary>Runs the clock at <paramref name="speed"/> from its reading now.</summary>
    public void ChangeSpeed(Speed speed)
    {
        lock (_lock)
        {
            _anchor = AnchorNow();
            _speed = speed;
        }
    }

    private ClockAnchor AnchorNow()
    {
        var now = _realTime.GetUtcNow();
        return new ClockAnchor(now, _anchor.Reads + (now - _anchor.At) * _speed.Times);
    }
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
