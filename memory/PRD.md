# Agent.ws — Product Requirements & Implementation Record

## Original problem statement
Build the full Agent.ws product using https://agentws.fun/ as the visual and structural reference. There is no ZIP or separate world asset; inspect the existing website and preserve its 3D world, buildings, environment, navigation, branding, layout, camera behavior, lighting, and exploration atmosphere. Do not replace the world with a generic SaaS dashboard. Build an autonomous AI agent civilization on top of that world.

**Positioning:** “Agent.ws gives AI agents a place to exist, a reason to work, and an economy of their own.”

**Core loop:** Create → Build → Work → Discover → Earn → Continue.

Agents have identity, brain, strategy, tools, data sources, rules, output format, behavior, missions, energy, history, treasury, reputation, and status. Creators define the system; users supply objectives; agents execute. The world is the interface, agents its inhabitants, work its activity, and the economy its consequence.

### Explicit user choices
- Solana for eventual real wallet identity/token holdings; **mockup first**, mint address and RPC not supplied.
- Live OpenAI GPT-5.4 with the Emergent universal key if no personal API key is required; otherwise clearly labeled simulation. Both live and explicit demo execution are implemented.
- Demo USDC accounting only, separated from real funds.
- “Buat benar benar 3d kalau terlalu berat buat charnya pendek mini gitu dan bangunan di worldnya sesuaikan dengan konsep, lalu terkahir modul modulnya pop up sesuaikan dengan konsep ketika agent di clik dll.”
- Communicate with the user in Indonesian; original Agent.ws interface language/branding remains English.

## Personas
1. Explorer: enter the world, move with WASD/touch, discover residents and capabilities, inspect public profiles, join global chat.
2. Agent creator: connect an identity, qualify through holdings, configure agents, assign missions, review private results, decide what to publish.
3. Developer/advanced creator: configure methodology/tools/rules and later extend provider adapters.
4. Future economy participant: agent-to-agent hiring/payout relationships, not active in the initial version.

## Static core requirements
1. Retain the actual reference world and WASD movement, mouse/touch camera orbit, click interaction.
2. Existing world buildings become functional system entrances; agent clicks open identity profiles.
3. Creation is free. Holding ≥100,000 $AGENTWS qualifies; this is never a charge.
4. Falling below the threshold changes existing agents to SLEEPING; never erase identity/history/work/treasury.
5. Six categories: Research, Analyst, Scout, Content, Builder, Social Intelligence. Autonomous trading stays LOCKED.
6. Creation configures brain, strategy, tools, sources, rules, output format, behavior, name, and avatar.
7. Mission execution has visible stages, persisted work/results, and real provider tools or explicitly marked simulation.
8. Do not invent external research. Distinguish retrieved evidence, interpretation, uncertainty, and simulation.
9. Energy starts at100, decreases10 on each successful execution, prevents work below10, and refills fully after5hours using server time.
10. Exactly one independent secure server-side discovery roll per successful mission: 40%20c, 40%0c, 20%100c. No ten-mission guarantee.
11. Pool-limited rewards, transparent pool balance, no promise of passive income, no overdrafts.
12. An agent owns its recorded treasury balance; the initial economy is deliberately simple.
13. Private work feeds and reports, human-controlled X intent handoff, no account control or automatic posting.
14. Persistent identity/history/reputation and ACTIVE/WORKING/RESTING/SLEEPING states in world/profile.
15. Discover by category, name, status, recent creation, or completed-work count; no invented ranking scores.
16. Global user chat with server-side rate limit, no generated agent spam.
17. Mobile access to agents, creation, missions, profiles, work, wallet, energy, treasury, and chat.
18. Server validates ownership, eligibility, balances, energy, and reward settlement; client never decides economic results.
19. Future agent hiring and optional recharge are not overbuilt or silently activated.

## Reference inspection and design foundation
- Inspected rendered desktop and mobile https://agentws.fun/ and fetched original public `js/assets3d.js`, `js/world.js`, `js/agents.js`, HTML, and logo.
- Original procedural asset kit is retained/adapted in `frontend/src/world/assets3d.js`; source snapshots are in `/app/reference/`.
- Preserved desert ground, grid/pathways, western Agent Exchange/Land Offices/Skills Hall architecture and positions, billboards, cacti, rocks, lamps, central pedestal, orbit camera feel, and green Agent.ws logo.
- Replaced old fake chart/trading screen content with Agent.ws civilization/LOCKED messaging.
- Added contextual Research Lab and Work Archive buildings, small articulated 3D robot inhabitants, overhead state labels, and a controllable player.
- All imagery uses the actual reference logo or real rendered Three.js geometry, not a 2D fake world or dashboard hero.
- Initial HUD used green/lime; **superseded by the user's v2 direction below**. Current interface is graphite/copper/chalk with sky accents. The desert reference remains the main experience.
- Shadcn/Radix modeless terminal panels allow navigation across the topbar/dock while open. Header and dock remain visible/usable on desktop and390px mobile.

## Architecture decisions
### Frontend
- React19, React Router7, Three.js0.186 with OrbitControls, custom lightweight reference asset kit and mini robots, Lucide, Shadcn/Radix primitives, Sonner, ReactMarkdown.
- World persists across routes. `/agents`, `/agents/:id`, `/agents/:id/mission`, `/create`, `/missions/:id`, `/work-feed`, `/wallet`, `/treasury`, `/exchange`, `/skills`, `/chat`, `/docs` are contextual world terminals. The About/View world welcome layer is on the same mounted canvas, not a separate world/page.
- API base uses only protected `REACT_APP_BACKEND_URL`.
- World refresh5s; mission progress snapshots1s; chat4.5s. Mission execution happens server-side and continues when the tab closes.
- Demo session bearer is browser-local; disconnect/reconnect intentionally restores that browser's demo identity. Creation drafts survive wallet handoff in sessionStorage.
- World actors are reconciled against current server data and disposed when removed. First28 rendered actors keep the world lightweight; the discovery UI lists up to500 server records.

### Backend
- FastAPI/Motor/MongoDB, configured solely with existing protected MONGO_URL/DB_NAME.
- `db.py`: configured database/time helpers. `models.py`: constrained Pydantic input and safe output models.
- `server.py`: demo sessions, holdings, discovery/profiles, owner-only missions/work, global chat.
- `research_pipeline.py`: current live execution entry, with four separate streamed GPT-5.4 passes (plan, analysis, verification, report). `providers.py` supplies read-only source tools and retains the legacy illustrative adapter; its old single-chat live function is not used by run_mission.
- Live read-only tools: GitHub repository API search, Wikipedia search, public website reading. These are not a claim of exhaustive general-web/social search.
- Public URL reader checks scheme/standard ports, DNS public addresses, redirects, content type, response-size/time bounds. No code execution, wallet tools, or trading permissions.
- `missions.py`: persisted lifecycle, actual progress details, research artifacts, and output snapshots;420s cap; provider failure consumes no energy and creates no roll. The user-facing UI launches real research only; illustrative backend execution remains isolated/clearly identified for regression compatibility.
- `economy.py`: independent secrets.randbelow(100), integer-cent accounting, atomic pool reservation, idempotent agent energy/treasury credit keyed by mission ID, lazy server-time energy reset.
- Mongo public reads exclude `_id`; no ObjectId escapes into JSON. Economic state has no client-authoritative fields.
- Request-started work uses FastAPI BackgroundTasks; startup recovery resumes unfinished mission records. No fake periodic agents or browser-only regeneration timer.

### Storage
- `wallets`: demo identity, holdings, creation time.
- `sessions`: hashed bearer token, wallet relationship, expiration.
- `agents`: configuration, creatorWallet, status, energy/reset, treasuryCents, jobsCompleted, createdAt, generic public history, settlement keys, current mission lock.
- `missions`: private objective, creatorWallet, agent relationship, mode, lifecycle events/time, actual sources, output, review/private flags, reward roll/result.
- `pool`: demo initial/reserve cents and mission-unique discovery ledger, funding source and transaction state.
- `chat`: persisted user messages, author/wallet/time. Five messages per30seconds.

## Implemented — 2026-09-25
- Working full-bleed real3D reference-derived desert civilization, desktop WASD/orbit/click and mobile drag/D-pad, zoom/reset.
- Original branded header, world overview, resident list, transparent pool, global chat, wallet HUD, navigation dock; no fake autonomous trading activity.
- Contextual buildings, agent profiles, six categories, status animations, useful discovery/filter controls.
- Three-step agent creation covering all requested initial configuration fields; six robot avatar colors; free creation/100kholding gate.
- Demo Solana identity/holdings; sleeping/wake transitions preserve all records. Token spending is never required.
- Real live GPT-5.4 missions with public GitHub/Wikipedia/read-only website tools; actual external-source executions verified. Separate clearly labeled simulated provider.
- Private mission feed, progressive lifecycle, Markdown reports and retrieved-source links, history/discoveries, Keep Private review, explicit X compose handoff.
- Server energy100/10 with5hreset, atomic mission lock, independent secure reward roll and pool-capped/idempotent settlement, transparent demo treasury.
- Responsive desktop/mobile modeless world terminals, long-name wrapping, scrolling, accessible close/escape, stable topbar/dock transitions.
- Global chat persistence/rate limit. Agent Exchange is locked; no real trading, wallet permissions, payouts, or automatic publishing.

## Verification — 2026-09-25
- Testing agent report: `/app/test_reports/iteration_1.json`;13/13 backend tests passed, including live GPT-5.4 and actual public-source retrieval.
- Tested auth/ownership/private feed, holding gate, injected economic-field rejection, completion energy/jobs/treasury, mission locking, server-time refill, sleep/restore preservation, chat rate limit.
- Browser checks: real nonblank canvas pixels, image changes after WASD/camera rotation, creation draft preservation across wallet connection, mission completion, wallet persistence, mobile feature access.
- Fixed reported duplicate exchange title testid and modeless/dock transition behavior.
- Focused X test verified explicit compose popup, encoded text, demo label, and no automatic submission; external compose destination was intercepted solely for this handoff assertion.
- Final desktop1920×800 and mobile390×844: overflow[], no duplicate testids; topbar/dock transitions and long-form actions passed.
- Production frontend build compiled successfully; current dev app is running via existing supervisor configuration.
- Removed known QA-only agents/chat/ledger artifacts and refunded their demo-pool debits; preserved Field Researcher, user-created Atthena, and all non-test user records.
- Updated pytest fixture to await in-flight work and refund its own demo ledger on cleanup.

## Explicit limits / prioritized backlog

## Revision v2 — user-reported bugs and experience changes (2026-09-25/26)

### User's requested changes
1. Walking looked floating and unsmooth.
2. Other bots stood still, making the world feel dead.
3. Do not display USDC drop odds; users should see Discovery Rewards associated with work.
4. Add documentation and tutorial so people understand the product.
5. Jobs should be substantive research following the agent's strategy. Close the mission modal at launch, show current execution stage over the world, and open the final report only after completion.
6. Remove repetitive demo/test words from the main experience. User intends to integrate real Solana later.
7. Same-scene About/Docs/View world opening layer; animate entry and remove opening copy to focus on the world.
8. Follow-up: English documentation, no green interface/panels; use colors suited to the world.

### Implemented
- Rebuilt mini-robot rigs with ground-level shoes, articulated legs/arms, distance-driven gait, damped acceleration/deceleration/turning, terrain/path/plaza surface contact, and contact shadows. Removed whole-agent sine-wave hovering.
- ACTIVE inhabitants now walk A* routes with random destinations and pauses, avoid building obstacles, and pause for hover interaction. WORKING agents stay focused; RESTING/SLEEPING agents do not wander.
- Added `pathfinding` library; `locomotion.js` maintains navigation/ground contact. Static scenery is batched and animated robot parts are rendered as instanced meshes to reduce GPU draw calls. Original rigs remain available for picking.
- New same-canvas opening layer: About, Docs, View world; entry camera tween and fade. Opening title is unmounted after entry. Returning to About retains the same world/agents. Session entry preference survives refresh.
- English Field Guide (`/docs`) has six chapters: Getting started, Build an agent, Missions & research, Energy & identity, Discovery & treasury, Privacy & publishing. Added optional four-step guided tour from Docs/world controls.
- Replaced green interface colors with graphite/copper/chalk/sky, including panels, actions, robot avatars, logo tint, labels, and billboards. Natural vegetation remains green.
- Removed probability breakdowns, reward-roll explanation cards, and repeated demo/test/alpha labels from normal UI. Discovery appears as a consequence of completed work.
- Kept one accurate, small integration-status note in wallet and treasury: local simulated holdings / off-chain settlement not connected. Do not represent unconnected Solana or simulated USDC as real on-chain funds. No withdrawal warning banners were added.
- Current mission workflow runs **real separate work**, not artificial timers: creator-strategy JSON plan → enabled provider searches → primary-page collection → evidence analysis → independent verification → corrected final report. Actual stages and work artifacts are stored server-side.
- Launch closes the form and returns to the world. `useMissionTracker` polls owner-only work, restores active jobs across reload, shows current phase/details/elapsed/sources, and queues finished reports to auto-open once when back in the world. Closing a finished report does not loop it open again. Navigating to in-progress work returns to the world tracker rather than streaming a chat-like report.
- Expanded tracker displays all8stages: MISSION RECEIVED, PLANNING, SEARCHING, COLLECTING SOURCES, ANALYZING, CROSS-CHECKING, GENERATING OUTPUT, COMPLETED. Reports display the plan and verification notes on demand.
- Disabled tools remain enforced by the backend. Energy/reward/ownership logic unchanged. Probabilities remain private server implementation details, not public UI copy.
- Mobile long-name follow-up fixed with flexible wrapping, including40-character unbroken names; timer/toggle/dock/D-pad remain accessible.

### Verification (testing-agent reports, not inspection-only claims)
- `/app/test_reports/iteration_2.json`:13/13 existing backend regressions plus2/2 focused real research tests passed. Real sources, independent plan/analysis/verification artifacts, all8chronological stage events, disabled-tool enforcement, and exact energy/jobs/treasury effects verified.
- Same report confirms fresh same-canvas intro, disappearing copy, docs before/after entry, walking/NPC motion, world interaction, live UI launch closing the form, persistent8-stage tracker, reload recovery, real completion auto-opening once, and no reopen loop.
- `/app/test_reports/iteration_3.json`: focused frontend follow-up **100% passed**, no remaining reported issues. Full40-character name wraps without clipping, expanded/collapsed tracker and elapsed timer work, long URLs wrap, mobile Docs/D-pad remain reachable, and no horizontal overflow at1920×800 or390×844.
- Iteration3 used isolated browser-route fixtures only for worst-case text layout, not to claim live research. Actual live research was separately verified in iteration2.
- Optimized frontend production build compiles successfully. Test-only agents/missions/chat were removed; their ledger debits refunded once. User-created Atthena and Field Researcher remain intact; pool accounting balanced and no orphan reward records found.

### Current v2 status
- All seven reported product issues, the palette request, and the follow-up mobile readability issue are implemented and verified in the agreed scope.
- Do not reintroduce full-screen chat output for running work, reward odds on public UI, constant hero text over the entered world, stationary ACTIVE residents, or green UI defaults.
- Remaining live-chain prerequisites below are unchanged. User plans to handle subsequent Solana integration; no trading/payout claims should be activated without it.

## Remaining integration backlog
### P0 — required before any live-money launch, intentionally not active now
- Obtain actual Solana $AGENTWS mint and trusted RPC endpoint.
- Implement signed-wallet authentication and server-verified SPL token balances. Current identities and holdings are DEMO, not blockchain verification.
- Fund and specify real USDC custody/settlement/payout policy, custody permissions, accounting reconciliation, and economic abuse controls. Current balances are DEMO, not transferable funds.
- Add public live-AI budget/rate/abuse controls and a production job queue/transaction architecture before broad exposure. Current request workers persist/recover, but are not a horizontally scaled job platform.

### P1
- Expand source adapters to dedicated general-web/current news and controlled social-intelligence APIs; currently GitHub/Wikipedia/public webpages only.
- More structured methodology templates and creator-editable versioned agent configurations.
- Production-scale reward ledger collections/transactions and durable worker leases; current atomic embedded ledger fits the initial demo scope.
- Refine world population LOD/streaming beyond28visible agents and richer non-spam autonomous presence.

### P2
- Agent-to-agent hiring: requesterAgentId/contract/task/payment orchestration with the existing agent-mission-ledger boundaries.
- Optional energy recharge, only if intentionally requested and funded; core usage stays free.
- Optional report sharing/reputation milestones without publishing private work automatically.
- No autonomous trading planned for this initial release; exchange remains locked.

## Next tasks
1. Review the world and agent workflow with the creator; preserve the current civilization instead of rebuilding a dashboard.
2. When requested, connect real Solana verification using supplied mint/RPC without changing current demo records.
3. Expand research sources or introduce the first scoped agent-to-agent collaboration feature, keeping human publication control.

## Repository continuation and identity revision — 2026-09-26
### User request (original)
“Bro clone repo ini gue mau lanjutin proggresnya disini https://github.com/karbu5525-ops/Wsag clone semua jangan ada yg ketinggalan atau keubah, lalu edit pertama ganti about depannya dengan ini The civilization where autonomous AI agents have identities, build economies, and interact freely, kedua gue mau ubah konsepnya 1 wallet 1 agent gak bisa create berkali kali, ketiga avatar di plaza masa user create agent, agentnya nongol tapi bukan user yg kendaliin, avatar user malah YOU bukan si agent yang dibuat, kalau memang belum login avatar YOU boleh deh sebagai avatar exolore user yg gak login, tapi kalo udah logij harusnya udah sesuau avatar agantnya, itu aja dulu deh coba”

Clarified: one non-deleted agent per wallet; replacement permitted after deletion. Controlled avatar uses own agent's name/color, guest YOU only. Additional request: “buat agent nyelesain jobnya rentang waktu 1-5 menit random sesuaikan dengan tingkat deep search si agent”.

### Implemented
- Imported all 153 tracked upstream files byte-identically from commit `f3ce5e5e8d53f32eac4bd733639333b5ba140b22` before scoped edits. Full upstream checkout/history retained at `/root/wsag-original`; pre-import workspace backup at `/root/wsag-workspace-before-import.tar.gz`. No original files omitted. Environment-specific protected database/frontend settings retained; restored missing existing AI/source settings. Git repository does not contain the previous runtime database.
- Exact requested About description; existing scene, assets, palette and routes retained.
- Creation guard and unique partial `activeWallet` index prevent simultaneous duplicates. SLEEPING/RESTING/WORKING count as owned, not an extra free slot. Legacy duplicates remain intact; oldest non-deleted record is the deterministic primary avatar.
- Owner-confirmed soft deletion frees the slot, hides the actor and preserves work/treasury archives; deletion while working is rejected. No transfer of archived balances to replacement agents.
- Player now uses owned agent's name/color/status and is excluded from wandering NPCs. Guests use YOU; connected wallets without agent use EXPLORER. Ownership changes reconcile on creation/deletion/disconnect/reconnect; WASD/touch control remains.
- Depth-aware server work windows persisted as targetDurationSeconds/expectedCompletionAt/deadlineAt: Quick60–120s, Standard120–210s, Deep210–295s plus settlement margin to5min. Scope changes search/page/evidence budgets. Finished research is held until its selected target, not represented as continued external research. Unfinished work times out before5min without energy/reward. Reload retains targets; prepared results recover without rerunning AI. Existing request-started tasks retained, not a recurring schedule.
- Initial live GPT-5.4 quick test passed (`pytest_iteration4_live_quick.xml`,112s). Original testing run timed out before final report; fixed its remaining409-vs403 guard ordering and cleanup-related missing-record handling.

## Specialist minds, real tools, and My Agent — 2026-09-26
### Latest original request
“Hmmm masih banyak yg kurang yang terkonsep, pertama masalah agent, di create agent udah jelas ada category nya masing masing beda data, tapi pas di mind nya semua sama harusnya beda beda lah dari kata kata contohnya dari toolnya pokonya masing masing beda lah sesuai dengan category yg dipilih user untuk create agent bukan semua sama begitu sesuaikan , buat lebih nyata lah, tools nya juga asatga 3 biji doang apa gunanya tambahin lah dan kasih user optional kaya link url untuk tools nya bisa berbentuk url link biasa atau url json gitu. Paham gak? Coba ask me dulu sebelum build , sama 1 lagi ketika gue udah punya agent gue bingung sendiri nyari agent gue dimana gak ada menu agent gue pribadi, menu gambar robot dipencet malah ke explore agent emang disitu ada agent gue tapi kaya gak enak aja gitu gak ada profile agent kita sendiri yg. Paham? Ask me”

Explicit follow-up: editable distinct category presets; all meaningful category-appropriate tools plus optional typed instructions/custom links. Both read APIs and actions with separate human permission. Add OpenAI/Claude model options but KEEP THEM DARK/DISABLED; only GPT-5.4 enabled. Robot icon opens My Agent for owners, with adjacent Other Agents/Explore tab inside the same module; without own agent keep Explore.

### Architecture and implementation
- Canonical server catalog (`agent_catalog.py`, GET `/api/catalog`), used by UI AND Pydantic category defaults. Six genuinely different strategies, enabled/recommended tools, source descriptions, safety rules, output formats, mission examples and optional-instruction placeholders. Switching categories restores per-category in-memory edits instead of mixing every category's methods.
- 13 available tool types across category-appropriate selections: Public search, Academic papers, Read websites, GitHub, JSON data, CSV data, Statistics, News & RSS, API documentation, Compare sources, Cross-check sources, Content drafting, Sentiment analysis. Retrieval/statistics are actual backend adapters; semantic comparison/sentiment/drafting are instructions executed by the existing real streamed GPT research/verification/report passes. They do not claim separate proprietary APIs or live social access.
- Crossref scholarly metadata search; bounded JSON/CSV reading, deterministic numeric-column statistics; defused RSS/Atom parsing; OpenAPI endpoint extraction. Data sources and custom GET URLs participate in research. No file-upload storage added.
- Up to8 custom named tools with URL, GET/POST, website/JSON/CSV/RSS format, optional secret headers and default JSON body. Additional specialist instructions remain optional and influence methodology. Secret headers encrypted with server-only `TOOL_SECRET_KEY`, omitted from browser draft and public profiles, owner sees header names only. URL changes require headers re-entered or cleared.
- `safe_http.py`: public-network-only HTTP, connection-time DNS resolution pinned through aiohttp resolver; bounded20s/350KB responses; read-only redirects validated at each hop; no redirects for authenticated or POST calls; no arbitrary code execution.
- POST tools NEVER run during missions. Private Tools & permissions panel creates exact PENDING URL/payload snapshot, with explicit Approve & send once or Reject. Atomic claim prevents repeated send; owner-only history and redacted responses. Failures/restarts become FAILED_OR_UNKNOWN because remote action may already have happened; never auto-retry. No financial/trading permissions added.
- Owner-only GET `/agents/:id/settings`, PATCH `/agents/:id/mind`, custom action draft/list/approve/reject endpoints. Public world/profile excludes all custom tool credentials/config. Existing auth unchanged.
- Mind editor for existing agents; apply category defaults with explicit confirmation, retaining custom endpoints. Editing blocked while working; existing agents are NOT silently overwritten.
- Model picker: GPT-5.4 enabled; GPT-5.4 Mini, GPT-5.2, GPT-4.1, GPT-4o, o3, Claude Opus4.7, Sonnet4.6, Haiku4.5 visually dimmed/disabled. Backend rejects locked model values, not just UI.
- `/agents` now wraps a stable single world module with My Agent/Other Agents tabs. Owners land on own profile; Explore uses `?view=explore`; robot reopens own default. Guests/no-agent wallets still get inhabitants list. Existing direct public profile routes retained.
- New components kept separate: AgentMindForm, ModelPicker, CustomToolsEditor, AgentModuleTabs, AgentToolsPanel, EditAgentMind. Existing graphite/copper visual system preserved. Fixed transient long-name toast overflow during desktop-to-mobile resize and prioritized player label stacking.

### Verification
- `/app/test_reports/iteration_4.json`:9/9 targeted backend tests and executed frontend flows passed; no reported blockers. Tests are in `backend/tests/test_iteration5_new_features.py` (filename iteration5, report iteration4).
- Real GPT-5.4 Analyst mission read GitHub JSON, computed numeric statistics and persisted plan/analysis/verification/output. Real harmless httpbingo POST sent after approval, with redacted echoed headers; reject and repeated-approval409 verified.
- Six category defaults, locked-model validation, custom-tool validation, private settings/secret omission, category-switch edit preservation, resetting defaults while retaining endpoints, and My Agent tabs tested.
- Self-check: Crossref returned5 real publication records; numeric summary and RSS parsing checked. These small RSS checks used explicit parser fixtures, not a claim of a live news provider.
- Final own-agent screenshots at1920×800 and390×844 verify actual connected My Agent, not guest Explore. Long unbroken name wraps, overflow[], robot resets to My Agent, other tab switches, mobile touch moves blue owned actor, one owned actor/no duplicateYOU. Desktop WASD and other NPC motion verified by testing agent.
- `yarn build` compiled successfully; backend Python compilation passed. Test agents cleaned separately; user-created records and archives retained. Test fixture cleanup now refunds only its own ledger entries.

### Current limits and prioritized next tasks
- P0 active scope: no known blocking issue from executed tests. Existing simulated wallet/USDC status remains as before; real Solana work still deferred by prior choices.
- P1: optional connection-check button for custom tools, better per-source failure details, report-to-report comparisons. Provider failures are surfaced; user-supplied APIs must be reachable and accept supplied credentials.
- P1: production-volume controls for external actions and live AI; existing demo architecture not a durable multi-worker queue.
- P2: optional focus-my-agent camera control and specialist visual badges; shared mission templates or verified work milestones.
- Keep all alternate models locked until the user explicitly asks otherwise. Do not silently enable automatic POST, code execution, posting, wallet spending, or unsupported social-platform access.

## Plaza update work — 2026-09-26 (paused by user before full verification)
- User requested exact Exchange notice “Agent Exchange is not a trading terminal”; right billboard title “The next chapter”, body “One agent could commission useful work from another.”, tagline “Get paid while your agent work.”; left billboard exclusively project News Feed.
- Clarified News Feed: versioned, latest-first, curated from completed project work, only major changes such as camera improvements, UI/rendering, tools and bug fixes. App release-note versions are local editorial labels, not claimed upstream Git tags.
- Also requested focus-own-agent camera button and pre-mission connection indicators. Implemented scoped frontend/backend files: `projectUpdates.js`, `projectBillboards.js`, `ProjectNews.jsx`, `plaza-updates.css`, `ToolHealthPanel.jsx`, `tool_health.py`, plus routes/WorldEngine/HUD integrations.
- GET diagnostics read/validate configured sources; POST diagnostics only attempt public DNS + TCP/TLS connectivity, never send HTTP POST or payload. POST results deliberately say host-only / credentials and endpoint unverified. Owner-only persisted checks invalidate when tool configuration changes. Automatic mission-form check uses a five-minute freshness window; manual recheck available.
- Focus button implemented for own agent only, smooth responsive tween, reset/orbit cancellation, and no guest focus. Added camera telemetry for narrow verification.
- Frontend build and initial news/billboard desktop1920x800/mobile390x844 screenshots passed with overflow[]. User paused before testing-agent verification of focus behavior and tool diagnostics. Do NOT treat these as fully regression-tested based on the later keyboard-only report.
- User explicitly requested fewer tests and an explanation of actual agent integration and multiplayer limits. Explained shared GPT-5.4 pipeline with real category/tool configuration, real sources/statistics vs prompt-based synthesis, local avatars (no shared real-time player positions), and existing simulated balances.

## Keyboard runtime crash fix — 2026-09-26
### Report
“Cannot read properties of undefined (reading 'toLowerCase')” at `onKey`, `static/js/bundle.js:18594:25`; digest `.emergent/recordings/crash-1790427700135.md`. Context: `/create`, category changes, gold avatar, typing a five-character name and repeated context menus.

### Scoped fix
- Changed ONLY `WorldEngine.js` keyboard handler for this request. Previously keyup unconditionally called `e.key.toLowerCase()`, even when the event supplied no key.
- Non-string keys and non-movement keys are ignored. Handles keyup before editing/dialog guards so held movement can still be released. Composition and modifier shortcuts do not start walking. Optional target/closest handling avoids missing-target errors; form/contenteditable/textbox typing never controls the player.
- No auth, data, AI, economy, visual layout or new feature changes in this bug fix.

### Verification
- Mandatory testing agent report `/app/test_reports/iteration_5.json` read and passed, no remaining issues in this narrow scope.
- Replayed reported create-form sequence; injected missing/null/numeric/empty keyboard keys; no `toLowerCase` crash or pageerror. Confirmed form typing does not move player; uppercase/lowercase WASD/Arrow keys work outside dialogs and keyup/blur stop movement. Mobile390x844 smoke passed.
- No backend/LLM/large regression suite run; no accounts or test data created. Intermittent browser automation load-event timeout was noted, while DOM and user flows loaded and worked; not reproduced as an application runtime failure.
