# Coding standards

Judgement calls a reviewer applies to a diff. Mechanical rules are enforced by tooling instead, so leave them to it: the web app's `npm run lint` and `tsc -b`, and the convention tests in `server/tests/ScoreMap.Server.Tests/Conventions/` (e.g. cancellation is judged by the token, never by exception type).

## Fakes fail the way the real thing does

A fake standing in for an outside service (ESPN, Nominatim, Wikidata, Commons, a stream site) can produce each way the real service fails, and the tests cover each one: an error status, no answer at all (a timeout, which `HttpClient` raises as `TaskCanceledException` around a `TimeoutException`), and a cancellation by the caller. A fake that only ever throws `HttpRequestException` lets the other failures through untested; that gap hid #24, where one ESPN timeout stopped the server.

When a diff adds a call to an outside service, or a fake for one, check that its failure handling is tested for each of these.

## Names and comments use the glossary's terms

Identifiers, comments, messages and UI text name domain concepts with the terms in `GLOSSARY.md`. Flag any term the glossary lists under _Avoid_ for the concept meant: "game clock" for the scenario clock, "pace" or "rate" for the speed. It's a judgement call, since many _Avoid_ words are everyday ones that are fine in other senses (a game's "location" in a geometry helper, an "event" in the DOM).

## Seeded tests assert what every seed gives

A test of something seeded (a scenario's fill, play) checks a property the code guarantees, such as a fill's Disrupted games going Postponed, Suspended and Canceled in turn, not one its seed happens to produce, such as which cities a fill picks. A seed-lucky test passes until an unrelated change draws one more random number, then fails far from the change that broke it, as "worldwide disrupted in every way" did when fill started drawing teams. Where a seed's particular outcome is the point, a comment beside the assertion says so.
