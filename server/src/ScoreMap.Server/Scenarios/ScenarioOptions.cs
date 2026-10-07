namespace ScoreMap.Server.Scenarios;

/// <summary>Scenario settings, under "Scenarios". The scenario to run is the root "Scenario" setting.</summary>
public sealed class ScenarioOptions
{
    /// <summary>The folder of scenario files (one <c>&lt;name&gt;.json</c> each), relative to the content root.</summary>
    public string Folder { get; set; } = "Scenarios/Files";
}
