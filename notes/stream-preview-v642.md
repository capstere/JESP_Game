# JESP AI 6.4.2 — presentation-only optimization

The live SSE preview previously wrote textContent, scroll position and status for every fragment. It now retains only a 6000-character preview tail and batches paints with requestAnimationFrame, backed by a 100 ms timer. Completion/error/cancel explicitly flush before the terminal status; a new request clears pending callbacks, including consecutive requests with the same role. Scrolling upward disables forced scrolling to the bottom. Unicode tail truncation avoids starting with half an emoji. The startup version now uses VERSION instead of a stale 6.0.1 literal.

No prompts, models, quotas, credentials, backend handlers, inference parameters, final-answer data, files, tools or agent verification gates are changed. This improves UI work, not model intelligence or generation speed. JSON remains default and SSE remains opt-in.

## Reproducible verification

- Existing agent regression suite remains intact (244 tests at baseline).
- 14 deterministic preview tests cover batching, terminal flush, timer fallback, stale callbacks, role changes, bounds and teardown.
- Real Chromium compares identical simulated 1000-fragment input against baseline commit 231d9aa402c7e411f6fc7e3d023640cf491ef846 and the candidate, checking exact final-answer equality and counting preview text writes.
- Browser checks include scroll preservation, cancellation, second requests, inert HTML-looking output and an 8000-character final answer with a bounded preview.
- Existing SSE UI safety tests and sandbox browser tests are retained.

Read the completed GitHub Actions artifacts for actual before/after counts. These UI tests simulate provider responses and do not claim a new real-model reasoning benchmark.
