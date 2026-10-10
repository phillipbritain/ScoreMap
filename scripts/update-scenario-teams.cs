// Makes the checked-in scenario team list (ADR-0009): asks ESPN's teams endpoint for each league in
// server/src/ScoreMap.Server/appsettings.json and writes their teams to scenario-teams.json beside it,
// each with its name, abbreviation and logo as ESPN gives them. Run it when a league's teams change
// (a new season's Champions League clubs, an expansion team) or a league is configured, then check
// the file in:
//
//     dotnet run scripts/update-scenario-teams.cs
//
// The NCAA leagues have hundreds of teams, so they keep only the schools in ncaaSchools; NCAA Baseball
// also leaves out those with no varsity baseball. The file is written only once every league is
// fetched, so a failed run leaves it as it was. Exits with 1 if a school isn't found or ESPN fails.
#:property PublishAot=false

using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

var serverProject = Path.GetFullPath(Path.Combine(AppContext.GetData("EntryPointFileDirectoryPath") as string
    ?? throw new InvalidOperationException("Run with `dotnet run scripts/update-scenario-teams.cs`"),
    "..", "server", "src", "ScoreMap.Server"));

// The Power 4 conferences' schools, and Notre Dame, by the location ESPN gives them.
string[] ncaaSchools =
[
    "Boston College", "California", "Clemson", "Duke", "Florida State", "Georgia Tech", "Louisville", "Miami",
    "NC State", "North Carolina", "Pittsburgh", "SMU", "Stanford", "Syracuse", "Virginia", "Virginia Tech", "Wake Forest",
    "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State", "Minnesota", "Nebraska", "Northwestern",
    "Ohio State", "Oregon", "Penn State", "Purdue", "Rutgers", "UCLA", "USC", "Washington", "Wisconsin",
    "Arizona", "Arizona State", "Baylor", "BYU", "Cincinnati", "Colorado", "Houston", "Iowa State", "Kansas",
    "Kansas State", "Oklahoma State", "TCU", "Texas Tech", "UCF", "Utah", "West Virginia",
    "Alabama", "Arkansas", "Auburn", "Florida", "Georgia", "Kentucky", "LSU", "Mississippi State", "Missouri",
    "Oklahoma", "Ole Miss", "South Carolina", "Tennessee", "Texas", "Texas A&M", "Vanderbilt",
    "Notre Dame",
];
// Schools above with no varsity baseball team, though ESPN lists one.
string[] noBaseball = ["Colorado", "Iowa State", "SMU", "Syracuse", "Wisconsin"];

var leagues = JsonNode.Parse(File.ReadAllText(Path.Combine(serverProject, "appsettings.json")))!["Leagues"]!.AsArray()
    .Select(league => (Name: (string)league!["Name"]!, Key: (string)league["Key"]!))
    .ToList();

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
var list = new JsonObject();
var problems = new List<string>();
foreach (var (name, key) in leagues)
{
    // The key's query (such as "?groups=50") picks a scoreboard's games, not a league's teams.
    var url = $"https://site.api.espn.com/apis/site/v2/sports/{key.Split('?')[0]}/teams?limit=1000";
    JsonNode response;
    try
    {
        response = JsonNode.Parse(await http.GetStringAsync(url))!;
    }
    catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
    {
        Console.WriteLine($"FAILED: {name} ({url}): {e.GetType().Name}: {e.Message}");
        return 1;
    }
    var teams = response["sports"]![0]!["leagues"]![0]!["teams"]!.AsArray()
        .Select(entry => entry!["team"]!)
        .Where(team => team["isActive"]?.GetValue<bool>() != false)
        .ToList();

    if (name.StartsWith("NCAA", StringComparison.Ordinal))
    {
        var schools = name == "NCAA Baseball" ? ncaaSchools.Except(noBaseball) : ncaaSchools;
        var picked = new List<JsonNode>();
        foreach (var school in schools)
        {
            var found = teams.Where(team => (string?)team["location"] == school).ToList();
            if (found.Count == 1)
                picked.Add(found[0]);
            else
                problems.Add($"{name}: {found.Count} teams at \"{school}\"");
        }
        teams = picked;
    }

    list[name] = new JsonArray(teams
        .Select(team => new JsonObject
        {
            ["name"] = (string)team["displayName"]!,
            ["abbreviation"] = (string?)team["abbreviation"],
            ["logoUrl"] = (string?)team["logos"]?[0]?["href"],
        })
        .OrderBy(team => (string)team["name"]!, StringComparer.Ordinal)
        .ToArray<JsonNode?>());
    Console.WriteLine($"{name}: {teams.Count} teams");
}

foreach (var problem in problems)
    Console.WriteLine($"NOT FOUND: {problem}");
if (problems.Count > 0)
    return 1;

// Unescaped, so names with accents (Atlético Madrid) stay readable in the checked-in file.
var json = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
File.WriteAllText(Path.Combine(serverProject, "scenario-teams.json"), list.ToJsonString(json));
Console.WriteLine("Wrote scenario-teams.json.");
return 0;
