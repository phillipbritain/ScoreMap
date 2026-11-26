# Domain docs

ScoreMap has one domain context: one `GLOSSARY.md` at the repo root, and its decisions in `docs/adr/`.

- **Before working in an area**, read the glossary's terms for it and the ADRs that touch it.
- **Use the glossary's terms** when naming a domain concept, in an issue title, a proposal, a test name or code, and not the synonyms it lists under _Avoid_. A concept it doesn't have yet is either new language to reconsider or a gap to add (the domain-modeling skill).
- **An accepted ADR stays as written**: details that change later belong in the code and docs. When the decision itself changes, a new ADR supersedes it, and the old one's status becomes `superseded by ADR-NNNN`.
- **Say so when work contradicts an ADR**, rather than overriding it quietly: _Contradicts ADR-0021 (mostly games happening now), but worth reopening because…_
