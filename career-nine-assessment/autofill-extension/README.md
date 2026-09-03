# Career-9 Assessment Autofill (Chrome extension, dev tool)

Random-fills the assessment portal **through the real DOM** — no code changes,
no sessionStorage prefill — mirroring the in-app dev autofill
(`src/utils/devAutoFill.ts`). It walks the whole flow from the demographic
page to the **last question**, then stops so you can review and submit
manually. It never clicks Submit.

## Install (load unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder (`career-nine-assessment/autofill-extension/`)

## Use

1. Log in to the assessment portal and open an assessment (get to the
   demographic page — or any later page, it picks up wherever you are).
2. A small **⚡ C9 Autofill** panel appears bottom-right. Click **▶ Start**.
3. Watch it go. Click **■ Stop** any time to take over manually.
4. It stops by itself on the last question with
   "✅ Done — last question filled. Submit manually."

The running state survives reloads and SPA navigation (per-tab
`sessionStorage`), so it keeps going across section changes.

## What it handles

| Surface | Behavior |
|---|---|
| Demographic details | Fills email/phone, text, number, date, dropdown, radio and checkbox fields (avoids "Other" when possible, fills the "Please specify" box if picked), then clicks **Next** |
| General instructions | Ticks "I have read and understood", clicks **I'm Ready to Start!** |
| Section select | Clicks the first section not marked completed |
| Section instruction page | Clicks **Start Assessment** |
| Section instructions popup | Waits out the 3-second OK countdown, clicks **OK** |
| Single/multi choice | Picks a random number of options like the dev autofill; respects min rules (the "Select N more" gate) and max caps (disabled checkboxes / single-choice replacement) |
| Ranking | Assigns a random permutation of ranks via the dropdowns |
| Text / MQT | Types `autofill-xxxxxx` tokens into each response box |
| Dropdown questions | Picks a random category, then selects options |
| Game options | Skipped (same as the dev autofill) |
| Inactivity warning | Acknowledges and continues |
| Navigation | Clicks **NEXT → / NEXT SECTION →**, or lets the app auto-advance |
| Submit | **Never.** Stops when the last question is answered; also stops if the confirm dialog ever opens |

## Scope / safety

Injected on **all http/https sites** so it works on any host — localhost,
LAN IPs, staging, prod, tunnels. The panel mounts on every page and always
shows the current route plus the screen it detects (e.g.
`/demographics/12 — demographics`); on pages it doesn't recognize it reads
"nothing to fill" and takes no action. Autofill only ever acts from the
demographics page onward — registration/login/campaign pages are display-only.
On any host other than localhost/LAN/staging the panel shows a red
"⚠ LIVE — writes real data!" banner — starting it on prod creates real
answer rows, so mind which tab you press Start in.

After ANY edit to these files: chrome://extensions → click ↻ Reload on the
extension card → refresh the portal tab. The panel only mounts on the
assessment app (not react-social on the same localhost).

If the UI copy of the buttons changes ("NEXT →", "OK", "I'm Ready to Start!",
"Yes, Submit", demographic "Next"), update the matching regexes at the top
sections of `content.js`.
