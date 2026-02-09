# Audit History

Chronological list of repository audits for Pickled Citizens.

| Date | Critical | High | Medium | Low | Total | Summary |
|------|----------|------|--------|-----|-------|---------|
| [2026-02-08](./2026-02-08-audit.md) | 2 | 5 | 6 | 5 | 18 | Initial audit. Debug endpoint in prod, duplicate RLS policies, 15+ `any` types, no tests. |

## Trend Analysis

**2026-02-08 (Baseline):**
- First audit establishes baseline metrics
- Key concerns: security (test endpoint, RLS duplicates), type safety, zero test coverage
- No previous data to compare against

## How to Use

- Audits are performed weekly using Claude Code
- Each audit file follows the standardized template
- Action items carry forward until resolved
- Trend analysis compares current vs. previous audit metrics
