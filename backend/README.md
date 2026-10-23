# JESP anonymous gateway

The existing Supabase project is on the Free plan. This component runs a fixed-destination bridge to Kilo's documented anonymous free-model API. Visitors create no account, supply no key and purchase no credits. Hosting still belongs to the owner's existing account; this is not accountless infrastructure.

Deploy gateway.mjs as jesp-gateway, with JWT verification disabled deliberately for this anonymous API. Apply quota.sql first. The handler fails closed when the server-only quota RPC cannot run. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built-in server environment variables, never client configuration or repository secrets.

## Endpoints

GET /health returns code version and installed limits. GET /models returns the currently listed, zero-price free models (not a quality benchmark). POST /chat accepts validated text messages and optional functions. No arbitrary destinations, paid provider selection, caller auth headers or proxy parameters are forwarded.

Responses expose final content, tool calls, actual model ID and token usage, not hidden reasoning. Application tools still run in the user's browser; this gateway supplies inference. GitHub Actions is used only for development testing, not as an inference server for website visitors.

## Limits and cost boundaries

Project-wide: 12 model requests/minute, 150/hour, 1000/day, 10000/month; at most 3 concurrent requests. Daily-HMAC-IP bucket: 90/hour. Provider quotas and availability also apply. Counters and leases are database-atomic. These are inference quotas, not a guarantee against all HTTP-request flooding. Every request to a public server consumes hosting resources; the Free plan can suspend service when its quotas are exhausted. No plan upgrade or paid provider fallback is enabled.

CORS permits https://capstere.github.io; CORS is not authentication and does not stop arbitrary server-side clients. Global quotas provide the hard shared inference limit. No IP rotation or quota bypass is implemented.

## Privacy and data separation

The database stores only counters, expiring leases and daily HMAC-derived client identifiers. It does not store prompts, generated code, raw IP addresses or API credentials. Supabase infrastructure processes requests; Kilo and model providers receive prompts and relevant tool results. Free model providers may log data/use it to improve services. Do not submit secrets, personal data or confidential material.

jesp_agent_private is not exposed to visitors. Both tables have RLS, intentionally with no visitor policies. RPCs are SECURITY INVOKER and executable only by service_role. The security advisor's two INFO messages for RLS-with-no-policy are expected deny-by-default configuration, not missing public access.

## Verification

The live gateway CI checks actual anonymous inference, CORS, actual returned models, and rejection of a paid model. Full-build acceptance separately exercises the browser agent against this deployed gateway and tests the resulting generated game's movement, rotation, shooting, restart and nonblank canvas independently. Read recorded outcomes before calling a version verified.
