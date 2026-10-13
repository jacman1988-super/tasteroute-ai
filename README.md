# TasteRoute AI

A calm travel discovery app for the Qloo Agentic Hackathon, built with AI coding assistance.

## Experience

Choose Lisbon, Kraków, Warsaw or Barcelona, days, pace and interests. Find actual Qloo tags, then explicitly choose one typed meaning per interest. **Show places from Qloo** gives real API results. **Start free AI** loads Qwen2.5-0.5B-Instruct on the visitor's device with WebLLM 0.2.85.

**Let AI choose my places** runs a bounded agent: the model chooses `recommend_places`; the server calls Qloo `/v2/insights`; the model selects existing place IDs for a short list. Cards retain original descriptions and addresses, and the visible trace records actual decisions. Download the list as text. English is the default; Polish interface is available. Provider descriptions retain their original language.

These are visit ideas, not a timed itinerary. The app does not invent opening hours, prices, ticket availability or travel times.

## Judges: try it

Use current Chrome/Edge on a desktop with WebGPU and about 1 GB of GPU memory. First use downloads about 290 MB of model files plus runtime/tokenizer assets from Hugging Face and MLC's GitHub repository. Wait for **AI is ready on this device**. No model-service account or API key is required; inference runs on-device.

First scenario: Lisbon, 2 days, Calm, Coffee. Find interests; select **Coffee / urn:tag:cuisine:qloo**; start AI; let AI choose places. On October 13 actual public Chrome returned Matoli Gelato and completed both genuine Qwen decisions. Other tags/cities can return different or empty results. No fixture fallback is used. `DEPLOYMENT.txt` and `VERIFICATION.json` record hosted status after deployment.

## Build

Node.js 22.19+, npm or pnpm:

```sh
npm install
npm test
npm run build
npm run validate
```

`scripts/build.mjs` bundles the browser agent and pure API into `dist/server/index.js`, a Worker ESM entry. `.openai/hosting.json` declares the Sites project. Runtime needs a private `QLOO_API_KEY` secret. Never put its value in source, the browser or hosting manifest. No independent Cloudflare account was created. For standalone hosting use a Worker-compatible service and the same private binding.

For local use, copy `.env.example` to ignored `.env.local`, enter your own Qloo key there privately, run the build, then `npm run dev`. Open http://127.0.0.1:8767/. Without a key the page loads and Qloo requests show a configuration error; no sample data is substituted. The old illustrative project is preserved as `legacy-demo.html`, clearly marked as sample data.

## Boundaries

Fixed categories and city go through the backend to `https://hackathon.api.qloo.com`. Choices are HMAC-signed and expire after ten minutes. The key never reaches the browser/model. Arbitrary queries, personal fields, edited tokens, invalid types and cross-origin browser requests are rejected.

Streaming caps: request 8 KiB, provider response 1 MiB. Provider calls time out after 30 seconds, have no automatic retries and sanitize errors. Per-isolate throttling: 30 calls/minute, 12 per IP/minute, two concurrent calls. This is not a global cross-isolate quota guarantee; the event provider quota also applies. IP counters stay in memory and reset each minute. No database, analytics, ads or preference storage.

GPU tasks are serialized. Cancellation/editing discards stale output and stops later tool calls; an already submitted computation or provider request may still finish. Unknown IDs, duplicates, extra fields and model prose are rejected. Membership checks cannot guarantee the semantic quality of every selection.

Selected Coffee is also a hard `filter.tags` requirement; other interests are taste signals. Aggregate affinities do not guarantee a business type or individual behavior. Verify current place details before visiting.

## Licenses and references

Original source MIT: `LICENSE`. WebLLM and Qwen2.5-0.5B-Instruct: Apache-2.0; esbuild: MIT. Bundle retains dependency legal comments; model files are fetched from publishers, not archived here. See `THIRD-PARTY.txt` and `WEBLLM-LICENSE.txt`.

- https://qloo.devpost.com/rules
- https://github.com/qloo/qloo-hackathon-kit
- https://webllm.mlc.ai/docs/user/basic_usage.html
- https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct

Devpost remains a draft until final submission success is verified. The public functional URL is https://tasteroute-ai.stillmole8.chatgpt.site ; hosted verification is recorded separately from synthetic checks.
