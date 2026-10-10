# Local ChatGPT research workflow — verification

Date: 2026-10-10 (Asia/Saigon).

## Result

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 15/15 passed across data and research packet tests.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`: 11/11 passed using an isolated Chrome profile.
- Focus/scroll assertions then added to the mobile research test; all 4 research E2E tests passed again.
- `npm run build`: passed; dashboard and 30 ticker/section combinations prerendered.
- Development server bound to `127.0.0.1:3000`; `/analyst/FPT` returned HTTP 200.

## Observed behavior

Source entry preserves document title, HTTP(S) URL, publication date, reporting period, page/location and excerpt. Incomplete source drafts block packet creation. Invalid executable URLs are rejected. Sources remain unverified, and mock financial numbers are excluded unless the user explicitly enables practice mode.

Copy and TXT download carry the same research packet and instructions. Opening ChatGPT uses a static URL. No outbound HTTP request from the page was observed while preparing, exporting, importing and reviewing a packet; no live ChatGPT submission was made.

Imported JSON must match the ticker, packet revision, data mode and seven report sections. Unknown citations and stale packets are rejected. Changing the question invalidates the old packet; changing the ticker resets the workbench. Valid reports remain labeled unverified. The empty template has a separate warning and is not presented as an AI answer.

HTML/script strings in source excerpts and report text rendered as inert text; no injected DOM element or test script executed. Citations open their source excerpt. Saved results include packet, report and warnings so their references are not lost.

Banking checklist is available before packet creation. Mobile step changes move keyboard focus to the new region and scroll it into view. Research report layout fit 320/390/768/1024/1440px; existing stock sections also fit 320px without document-level horizontal overflow.

## Fixes and environment observations

- Textarea labels were separated from their controlled values so returning to a step preserves stable label selection.
- Windows clipboard comparison normalizes CRLF/LF; no user content is otherwise changed.
- Alert assertions target the research workspace to exclude Next.js's separate route announcer.
- Stock-switch test waits for navigation before following the next link.
- The Analyst page now labels its workspace as local research; dashboard mock labels remain attached to the demo data screens.
- One initial Chrome launch exited before opening a page. Subsequent focused and complete runs launched successfully; no retry/skip was added to hide failures.
- The sandbox helper failed to initialize in this session. Approved host execution ran the checks; native in-app automation was unavailable. Browser evidence comes from Playwright and visual inspection of its screenshots.

## Screenshots

- `research-prepare-mobile.png`
- `research-transfer-mobile.png`
- `research-report-desktop.png`

These use clearly labeled test/mock content, not a real company's research report.

## Remaining limits

The website runs locally; ChatGPT processes submitted content online. Transfer is manual and has not been tested with a real ChatGPT-generated response. Schema/reference checks do not establish factual truth, document authenticity or whether a citation supports a claim. Snapshot IDs detect accidental mismatches, not malicious tampering. Prompt rules cannot guarantee the model resists injection or never fabricates information.

Only six demo tickers are available. Financial Engine, verified market data, automatic ChatGPT/Codex integration, PDF export and persistent research storage are not implemented. Research state is kept in memory; the user must download before reload or leaving the page. No deployment, paid API or order execution was used. Dependency audit findings from the previous Phase 1 record were not re-audited in this change.
