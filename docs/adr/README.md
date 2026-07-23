# Architecture decision records

Use an ADR for a durable technical decision that constrains future implementation. Do not use ADRs
for backlog priority, temporary plans, spike journals, meeting notes, or information already
expressed by code and tests.

The detailed evidence stays in the originating GitHub issue. The ADR captures the accepted outcome
and links back to that evidence.

## Naming

Use the next four-digit sequence:

```text
docs/adr/0001-short-decision-title.md
```

Accepted ADRs are immutable historical records. If a decision changes, add a new ADR that supersedes
the old one and link them in both directions.

## Template

```markdown
# ADR-NNNN: Decision title

- Status: Proposed | Accepted | Superseded
- Date: YYYY-MM-DD
- Decision owners: GitHub usernames
- Related issues: #123
- Supersedes: ADR-NNNN, if applicable

## Context

What forces the decision? Link the spike, feature issue, measurements, and platform documentation.

## Decision

State the selected approach and the boundaries future implementations must follow.

## Consequences

Describe important benefits, costs, limitations, migration effects, and follow-up work.

## Alternatives considered

List the credible alternatives and why they were not selected.
```
