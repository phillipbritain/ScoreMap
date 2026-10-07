# Coding standards

Judgement calls a reviewer applies to a diff. Mechanical rules are enforced by tooling instead, so leave them to it: the web app's `npm run lint` and `tsc -b`, and the convention tests in `server/tests/ScoreMap.Server.Tests/Conventions/` (e.g. cancellation is judged by the token, never by exception type).

## Fakes fail the way the real thing does

A fake standing in for an outside service (ESPN, Nominatim, Wikidata, Commons, a stream site) can produce each way the real service fails, and the tests cover each one: an error status, no answer at all (a timeout, which `HttpClient` raises as `TaskCanceledException` around a `TimeoutException`), and a cancellation by the caller. A fake that only ever throws `HttpRequestException` lets the other failures through untested; that gap hid #24, where one ESPN timeout stopped the server.

When a diff adds a call to an outside service, or a fake for one, check that its failure handling is tested for each of these.
