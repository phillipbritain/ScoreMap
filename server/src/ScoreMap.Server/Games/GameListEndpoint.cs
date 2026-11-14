using ScoreMap.Server.Live;

namespace ScoreMap.Server.Games;

public static class GameListEndpoint
{
    /// <summary>
    /// The games on the running board as plain text, one line per game, for an agent driving a local run
    /// (the run-scoremap skill): <c>GET /api/games</c>, with <c>?league=</c> keeping the leagues whose name
    /// contains it (any case: "ncaa" keeps every college league). In Development only; elsewhere it's not found.
    /// </summary>
    public static WebApplication MapGameList(this WebApplication app)
    {
        app.MapGet("/api/games", (string? league, RunningGameBoard board) =>
        {
            if (!app.Environment.IsDevelopment())
                return Results.NotFound("The game list is only available when ScoreMap runs locally");
            var games = board.Games
                .Where(game => league is null || game.League.Contains(league, StringComparison.OrdinalIgnoreCase))
                .OrderBy(game => game.League, StringComparer.Ordinal).ThenBy(game => game.StartTime)
                .Select(Line).ToList();
            var text = games.Count > 0
                ? string.Join('\n', games) + '\n'
                // The board fetches only while a browser is watching.
                : $"No games{(league is null ? "" : $" in a league matching \"{league}\"")} (the board fills only while a browser has the app open)\n";
            return Results.Text(text);
        });
        return app;
    }

    /// <summary>
    /// A game as one line: id, league, status and clock, who competes (away @ home, each with its poll rank,
    /// conference and score where it has them; a field's size and leader; a fight card's main event), venue and city.
    /// </summary>
    public static string Line(Game game)
    {
        var status = game.Clock is { Length: > 0 } clock && game.Status == GameStatus.Live ? $"Live {clock}" : game.Status.ToString();
        var contest = game.Contest switch
        {
            GameSides(var home, var away) => $"{Team(away)} @ {Team(home)}",
            GameField(var entries) => entries.Count == 0 ? "field not listed" : $"{entries.Count} entrants, leader {entries[0].ShortName}",
            GameBouts(var bouts) => bouts.Count == 0 ? "no bouts" : $"{bouts.Count} bouts, main event {bouts[0].First.ShortName} v {bouts[0].Second.ShortName}",
            _ => "",
        };
        var place = string.Join(", ", new[] { game.Venue.Name, game.Venue.City }.Where(part => !string.IsNullOrEmpty(part)));
        return string.Join(" | ", game.Id, game.League, status, contest, place);
    }

    private static string Team(GameTeam team) =>
        (team.Rank is { } rank ? $"#{rank} " : "") + team.Abbreviation
        + (team.Conference is { } conference ? $" ({conference})" : "")
        + (team.Score is { } score ? $" {score}" : "");
}
