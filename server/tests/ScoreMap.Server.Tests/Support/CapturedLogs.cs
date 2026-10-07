using Microsoft.Extensions.Logging;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A logger provider that keeps every message the server logs, so tests can check what was logged.</summary>
public sealed class CapturedLogs : ILoggerProvider
{
    private readonly List<(string Category, LogLevel Level, string Message, Exception? Exception)> _entries = [];

    public IReadOnlyList<(string Category, LogLevel Level, string Message, Exception? Exception)> Entries
    {
        get { lock (_entries) return _entries.ToList(); }
    }

    /// <summary>Messages logged at error level or above, with their category.</summary>
    public IReadOnlyList<string> Errors =>
        Entries.Where(e => e.Level >= LogLevel.Error).Select(e => $"{e.Category}: {e.Message}").ToList();

    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);

    public void Dispose()
    {
    }

    private sealed class Logger(CapturedLogs logs, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            lock (logs._entries)
                logs._entries.Add((category, logLevel, formatter(state, exception), exception));
        }
    }
}
