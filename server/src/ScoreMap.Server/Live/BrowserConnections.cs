namespace ScoreMap.Server.Live;

/// <summary>
/// Which browsers are connected to the games hub, so the poller runs only while
/// at least one is. Tracks connection ids rather than a count so a connection that
/// fails part-way through connecting can't push the count below zero.
/// </summary>
public sealed class BrowserConnections
{
    private readonly HashSet<string> _ids = [];
    private TaskCompletionSource _anyConnected = NewSignal();

    public void Connected(string connectionId)
    {
        lock (_ids)
        {
            if (_ids.Add(connectionId) && _ids.Count == 1)
                _anyConnected.TrySetResult();
        }
    }

    public void Disconnected(string connectionId)
    {
        lock (_ids)
        {
            if (_ids.Remove(connectionId) && _ids.Count == 0)
                _anyConnected = NewSignal();
        }
    }

    /// <summary>
    /// Whether a browser is counted as connected: from just after the hub sends its snapshot
    /// until it leaves.
    /// </summary>
    public bool IsConnected(string connectionId)
    {
        lock (_ids)
            return _ids.Contains(connectionId);
    }

    /// <summary>Completes as soon as at least one browser is connected.</summary>
    public Task WhenAnyConnectedAsync(CancellationToken cancellationToken)
    {
        lock (_ids)
            return _anyConnected.Task.WaitAsync(cancellationToken);
    }

    private static TaskCompletionSource NewSignal() => new(TaskCreationOptions.RunContinuationsAsynchronously);
}
