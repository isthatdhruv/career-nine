# Navigator-360 Scoring Engine — Spec Verification Report

**Run type:** Verification & diff only. No implementation code was modified.
**Audited implementation:** Java backend (`spring-social`), the live report-generation engine.
**Authoritative sources (priority order):** ① `Navigator360_Tech_Spec_v5_lock.docx` · ② `Career9_Master_v5 - Copy.xlsx` · ③ `Navigator360_EdgeCases_v4_1.xlsx` · ④ `Navigator-360_data_template_v4_1.xlsx`. Where code disagrees with the docs, the **code is the bug**.

### Methodology note (read first)
- The **Java engine is the sole production engine** (confirmed by user; the parallel `react-social` TypeScript engine is dead code). Every finding below is cited to **Java source `file:line`**.
- **Phase 3 execution:** the Java engine cannot be run headless here (needs Spring context + MySQL + the item bank). I verified the TS engine is **byte-identical** to Java on the stanine tables, normalization, `absoluteLevel`, grade-group, the suitability formula, the 15-career catalog and the flag logic, then executed the TS engine over all 32 fixtures as a faithful **behavioural proxy**. Every divergence observed at runtime was then confirmed in the Java source by direct quote. Items that depend on item-level inputs (cleaning/validity) are unreproducible from the trait-level fixtures **and** absent from code — reported as MISSING, not merely untested.

---

## 1. Executive Summary

**The implemented engine is a different architecture from the locked spec.** It is not a partial or drifting implementation of Navigator-360 v5 — large sections of the v5 pipeline were never built, and the core suitability formula is a different equation.

### The single most important finding
**CSI-1 / CSI-2 (🔴 CRITICAL):** The spec's per-cluster Cluster Suitability Index — `csi = 0.40·P + 0.30·A + 0.20·I + 0.10·V` over **24 canonical clusters** — does not exist. The code instead ranks **15 hardcoded careers** by `suitability = 0.60·potentialMatch + 0.40·valuesMatch + aspirationBonus` ([Navigator360EngineService.java:443](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L443)). The percentages printed next to "Career 1…9" on Page 4 are produced by an equation the spec does not contain, drawn from a catalog 9 clusters short of the canonical 24. Every downstream number (Top-9 membership, bar fill, CCI) inherits this.

### Status counts (28 rules)
| Status | Count | Rule IDs |
|---|---|---|
| ✅ MATCH | 4 | RAW-1, NORM-1, WT-1, WT-2 |
| ❌ MISMATCH | 9 | RAW-2, NORM-2, VG-3, WT-3, CSI-1, CSI-2, CSI-3, CCI-1, BAR-2 |
| ⚠️ PARTIAL | 6 | GATE-1, TIE-1, REL-1, FLG-1, STG-1, PH-1 |
| 🚫 MISSING | 7 | VG-1, VG-2, TOP9-1*, TOP9-2, TOP9-3, BAR-1, (CSI/24-cluster) |
| ❓ UNVERIFIABLE | 1 | DEV-1 |
| ➕ EXTRA | 1 | "Potential/Preference score" 0–100 construct (not in spec) |

\*TOP9-1 is logged as MISMATCH+MISSING (15 careers exist where 24 clusters are required).

### Severity counts
| Severity | Count | Headline |
|---|---|---|
| 🔴 CRITICAL | 11 | Validity gate, A/B/C gate, bias effect, ability raw weight, stanine bands, CSI formula+subscores+values, 24-cluster set, CCI, reliability target |
| 🟠 MAJOR | 7 | Gate CLOSED semantics, renormalisation, Top-9 cascade, bottom suppression, bar cell formula, bar labels, per-stage, placeholder cell |
| 🟡 MINOR | 1 | Tie-break cascade structure (determinism holds) |

### Five things a counsellor/student is affected by **today**
1. **Invalid assessments still produce reports.** No `total_issues > 3` gate and no A/B/C-minimum gate exist — a record that the spec rejects (ERR-01/02/04) is scored and a PDF is generated.
2. **Bias flags change nothing.** BIAS-01..04 are emitted (on the wrong thresholds) but never suppress a component, never reweight, and never hard-fail — a 100%-acquiescent profile is scored at face value.
3. **A `raw=15` personality trait is mis-banded as Moderate** (spec: High) and **ability answer "C" is weighted 3 instead of 2** — both shift bands, which cascade into every score.
4. **The Top-9 percentages use the wrong formula and a 15-item catalog**, never receive the ×1.05 reliability adjustment, and the bar's "MOST/LEAST SUITED" label is keyed to **rank position, not fit** — so a 45%-fit career in slot 1 is labelled "MOST SUITED".
5. **Insight-stage students get a CCI** the spec says to skip, and the CCI is a 3-level enum, not the `matched/mapped × 100` percentage.

---

## 2. Discrepancy Table

| Rule | Rule summary | Spec value (DOC) | Code value | file:line | Status | Sev |
|---|---|---|---|---|---|---|
| **VG-1** | Validity gate `total_issues>3`→invalid | 3=valid, 4=invalid, no report | No issue counter; no invalid path; records always scored | — (NOT FOUND) | 🚫 | 🔴 |
| **(clean)** | Item cleaning (blank→No=1, etc. +issue) | per §2.2.1 | No item-level cleaning / issue tracking | — | 🚫 | 🔴 |
| **VG-2** | A/B/C minimum (ERR-04 / WARN-02) | 0–2→ERR-04; 3–4→WARN-02; 5 ok | No selection-count check at all | — | 🚫 | 🔴 |
| **VG-3** | Bias threshold + suppress + reweight | ≥46 Yes(85%) etc.; suppress 1 comp; reweight→100; 2+=hard-fail | Raw-ratio ≥0.83/≤0.17 thresholds; **no** suppression/reweight/hard-fail | [Nav360:138-181](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L138-L181) | ❌ | 🔴 |
| **RAW-1** | RIASEC raw Yes×2+No×1 → 9–18 | as stated | Identical | [NavRGS:783-804](spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorReportGenerationService.java#L783-L804) | ✅ | — |
| **RAW-2** | Ability/MI raw; **Ability C=2** | A4 B3 **C2** D1 | Ability `C=3` (MI is correct C2) | [NavRGS:833-841](spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorReportGenerationService.java#L833-L841) | ❌ | 🔴 |
| **NORM-1** | `(raw−min)/(max−min)×100` | as stated | Identical | [Nav360:104-110](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L104-L110) | ✅ | — |
| **NORM-2** | Stanine bands | RIASEC H=**15**-18, M=12-14, L=9-11; Abil/MI L=3-**6**,M=7-9,H=10-12 | RIASEC H=16-18, M=12-15, L=9-11; Abil/MI L=3-5, M=6-9, H=10-12 | [Nav360:78-100](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L78-L100) + AbsoluteLevel.fromStanine | ❌ | 🔴 |
| **TOP-1** | Top 3/3/5 by norm desc | as stated | Implemented (sort by normPct desc) | [Nav360:674-677](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L674-L677) | ✅ | — |
| **GATE-1** | OPEN/HALF/CLOSED ×1.0/0.65/floor; CLOSED=cards suppressed, cover only | as stated | gateMul 0.65/1.0 + extra `<3High→0.70`; floors 3/2/3; **CLOSED never suppresses Top-9 / no cover-message** | [Nav360:185-275](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L185-L275) | ⚠️ | 🔴 |
| **WT-1** | P/I [.50,.30,.20]; Abil [.30,.25,.20,.15,.10] | as stated | Identical constants (but feed "Potential score", not CSI) | [Nav360:206,242,267](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L206) | ✅ | — |
| **WT-2** | Moderate contribution ×0.75 before sum | as stated | Identical | [Nav360:210](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L210) | ✅ | — |
| **WT-3** | Renormalise weights when qualified<N (.50/.30→.625/.375) | as stated | No renormalisation; trailing weight silently dropped (EC-18) | [Nav360:208-212](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L208-L212) | ❌ | 🟠 |
| **TIE-1** | Tier1→2→3 cascade; Tier3 locked, deterministic | as stated | Stable sort + partial legacy cascade; deterministic (EC-06 5×identical) but not the specified tiers | [Nav360:456](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L456) | ⚠️ | 🟡 |
| **CSI-1** | `0.40P+0.30A+0.20I+0.10V` per cluster | as stated | `0.60·potMatch + 0.40·valMatch + aspBonus` | [Nav360:443](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L443) | ❌ | 🔴 |
| **CSI-2** | P/A/I = Σ(norm × rank-weight) | as stated | Level→fixed points (H 13.3/10/10, M 8/6/6)×{1,.6,.3} | [Nav360:341-375](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L341-L375) | ❌ | 🔴 |
| **CSI-3** | V: base=100×(matched/**5**)−15×conflict, clamp[0,100] | as stated | base=matched/**student-count**×100; conflict by career-**name substring**; clamp low only | [Nav360:386-415](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L386-L415) | ❌ | 🔴 |
| **TOP9-1** | CSI for all **24 clusters**, Top 9 | 24 canonical clusters | **15** hardcoded careers, top 9 | [Nav360CareerData:33-138](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360CareerData.java#L33-L138) | ❌/🚫 | 🔴 |
| **TOP9-2** | Rank 9/10 cluster cascade A→F | as stated | Stable sort only; no cascade | [Nav360:456](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L456) | 🚫 | 🟠 |
| **TOP9-3** | Suppress bottom tier if 4+ of Top-9 <50 | as stated | Not implemented | — | 🚫 | 🟠 |
| **CCI-1** | `matched/mapped×100`; ≥70/40–69/<40; skip Insight | as stated | enum High/Mod/Low via top3/top9 overlap counts; **not** skipped for Insight | [Nav360:462-478](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L462-L478) | ❌ | 🔴 |
| **REL-1** | `csi_final=clamp(round(csi_raw×completion×1.05),0,100)` | applied to the CSI | ×1.05+clamp applied to the **Potential score**, not to career suitability; completion is an input param (default 1.0), never computed | [Nav360:282-286](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L282-L286) | ⚠️ | 🔴 |
| **DEV-1** | Top-1 dev plan (Low abilities→grow; non-High RIASEC→explore) | as stated | Narrative builder exists in FourPager; not verified to this rule | FourPagerEngineService | ❓ | 🟡 |
| **BAR-1** | `cell=clamp(ceil(csi_pct/11.11),1,9)` | as stated | `suitability9=max(1,round(suit/100×9))`; not emitted as a cell; no `ceil/11.11` | [Nav360:421-428](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L421-L428) | 🚫 | 🟠 |
| **BAR-2** | Band labels (DOC CONFLICT) | Spec: 1-3 LEAST/4-6 MOD/7-9 MOST · Excel: Worth Exploring/Strong Fit/Best Fit | Static labels by **rank third**: 1-3 MOST, 4-6 MODERATELY, 7-9 LEAST SUITED — keyed to rank, not csi cell | [career-navigator.html:1218-1302](spring-social/src/main/resources/four-pager-template/career-navigator.html#L1218) | ❌ | 🟠 |
| **FLG-1** | Full flag registry | ERR/WARN/BIAS/P per §2.4 | ERR-01/02/04 & WARN-01/02 **never emitted**; BIAS wrong-threshold + no effect; P-02 missing; P-03 dead code | [Nav360:138-630](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L138-L630) | ⚠️ | 🔴 |
| **STG-1** | Per-stage variations | Insight skips A + CCI; Page-4 cols by stage | Aspirations+CCI rendered for **all** stages; actions from hardcoded RIASEC maps (not Excel cols) | [FourPager:41-45,542-548](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/FourPagerEngineService.java#L41-L45) | ⚠️ | 🟠 |
| **PH-1** | `career_N_name`, `pN_pct`, `pN_cell` | all three ×9 | name ✓, pct ✓ (=suitability), **`pN_cell` absent** | [FourPager:596-611](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/FourPagerEngineService.java#L596-L611) | ⚠️ | 🟠 |

---

## 3. Per-Finding Detail (every non-✅)

### VG-1 — Validity gate absent · 🚫 MISSING · 🔴 CRITICAL
**Spec (§2.2.2 / Master "4. Scoring Pipeline" step 1):** "After item-level cleaning, count `total_issues` across D+E+F. `total_issues > 3` → ERR-01/02, record **INVALID**, no report." Boundary: 3 valid, 4 invalid.
**Code:** No counter, no invalid branch. `NavigatorReportGenerationService` performs only minimum-score eligibility notes ([:326-368](spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorReportGenerationService.java#L326-L368)); the pager engine scores unconditionally.
**Impact:** Records the spec rejects are scored and a PDF is produced; ops never receives the critical re-administer alert.
**Minimal fix (proposed):** Add a pre-scoring `validate(record)` that counts cleaning issues over D+E+F and returns an invalid result (no `computeNavigator360`) when `>3`; emit ERR-01 if blanks dominate else ERR-02.

### Item-level cleaning absent · 🚫 MISSING · 🔴 CRITICAL
**Spec (§2.2.1):** blank/double in D → substitute No=1, +1 issue; blank/double in E/F → exclude or keep lower, +1 issue.
**Code:** Raw answers are summed directly (`getStudentAnswerLabel`), unanswered RIASEC silently treated as No=1 with **no issue count** ([NavRGS:795-799](spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorReportGenerationService.java#L795-L799)). This is the dependency that makes VG-1 unimplementable today.
**Fix:** Introduce cleaning that returns `(cleanedItems, issueCount)` feeding VG-1.

### VG-2 — A/B/C minimum gate absent · 🚫 MISSING · 🔴 CRITICAL
**Spec (§2.2.3):** selections <3 in A/B/C → **ERR-04 invalid**; 3–4 → **WARN-02** (panel blank, record valid); 5 → normal.
**Code:** `selectedValues / selectedCareerAsps / selectedSOIs` are passed straight through with no count check ([Nav360:684](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L684)). Behaviourally confirmed: EC-29 (B=2, expected ERR-04) and EC-17/31/32 (3–4 selections, expected WARN-02) all produced a **full normal report with no ERR/WARN**.
**Fix:** Count selections per section pre-scoring; ERR-04 short-circuit for <3; attach WARN-02 + blank-panel flag for 3–4.

### VG-3 — Bias: wrong thresholds, zero scoring effect · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.2.4 / Master "9. Flag Registry"):** BIAS-01 ≥46 Yes (85%); BIAS-02 ≥46 No; BIAS-03 ≥26 D-responses; BIAS-04 ≥21 SD/D. Each suppresses one CSI component and reweights remainder to 100 (BIAS-01 → A=50/I=33.3/V=16.7). Any **2+ = HARD FAIL** (no Top 9, cover message).
**Code ([Nav360:138-181](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L138-L181)):** computes ratios on **aggregated raw scores**, not item counts: BIAS-01 `riasecTotal/maxRiasec ≥ 0.83`; BIAS-02 `≤0.17`; BIAS-03/04 `lowCount/size ≥ 0.83`. Flags are added to a list and **never consulted by scoring**. No reweight; no composite hard-fail (Top-9 always returned, [:689](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L689)).
**Behavioural:** EC-04 (dual bias, expected cover-message-only) produced a full Top-9 (`55,54,53,…`). EC-03 emitted BIAS-01 but also spurious P-05/P-06/P-10 and full scores.
**Impact:** Acquiescent/floored response sets are scored at face value; the most safety-critical psychometric guardrail is inert.
**Fix:** Re-implement thresholds on item counts; on a bias flag, drop that component and renormalise weights; if ≥2 bias flags, return a hard-fail result that the renderer maps to the cover-message branch.

### RAW-2 — Ability answer "C" weighted 3, not 2 · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.1):** Ability Likert A=4, B=3, **C=2**, D=1.
**Code ([NavRGS:833-841](spring-social/src/main/java/com/kccitm/api/service/Navigator/NavigatorReportGenerationService.java#L833-L841)):** `case "C": return 3;`. (MI's `miWeight` correctly returns C=2.)
**Impact:** Every ability raw using a "C" answer is inflated by up to +1/item (+3 max per 3-item trait), pushing traits up a band and changing Top-5 abilities, gate counts, and `potentialMatch`.
**Fix:** `case "C": return 2;` in `aptitudeWeight`.

### NORM-2 — Stanine band cutoffs shifted one rank · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.3, EC-13):** RIASEC **15–18 High**, 12–14 Moderate, 9–11 Low. Ability/MI 3–**6 Low**, 7–9 Moderate, 10–12 High. QA test: feed raw {9..18} → bands {L,L,L,M,M,M,**H**,H,H,H}.
**Code:** `riasecStanine` maps raw 15→stanine 6, and `fromStanine` treats stanine 6 as Moderate ⇒ **RIASEC 15 = Moderate**. `abilityMIStanine` maps raw 6→stanine 3 = Moderate ⇒ **Ability/MI 6 = Moderate** ([Nav360:78-100](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L78-L100)).
**Behavioural (EC-13):** input `I=15` classified **Moderate** (`I:15M`); spec demands High. Effective code distribution for {9..18} = {L,L,L,M,M,M,**M**,H,H,H} — diverges at 15.
**Impact:** A genuinely "High" personality trait (15) is suppressed to Moderate (and a "Low" ability of 6 promoted to Moderate), flipping gate counts (OPEN↔HALF), `potentialMatch` tiers and Top-9 ordering.
**Fix:** Shift the cutoffs — RIASEC High at raw≥15; Ability/MI Low at raw≤6 — or recalibrate the stanine tables to the spec bands.

### GATE-1 — CLOSED gate has no report effect · ⚠️ PARTIAL · 🔴 CRITICAL
**Spec (§2.3 step 5):** 0 High → **CLOSED**: career cards suppressed, cover message only.
**Code ([Nav360:185-275](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L185-L275)):** "0 High" only floors the internal Potential component (3/2/3) and raises P-01/05/06; it does **not** suppress the Top-9 career cards, which are computed independently and always rendered. Adds an unspecified third multiplier `<3 High → ×0.70` for ability. CLOSED cover-message path absent.
**Behavioural (EC-05, all-Low):** full Top-9 produced (`34,34,32,…`).
**Fix:** When the personality pillar is CLOSED, route to the cover-message-only render and suppress the Top-9 grid; remove or spec the 0.70 multiplier.

### WT-3 — No weight renormalisation when short · ❌ MISMATCH · 🟠 MAJOR
**Spec (§2.3 step 6, EC-18):** if qualified traits < N, renormalise remaining weights to sum 1.0 (`.50/.30 → .625/.375`).
**Code ([Nav360:208-212](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L208-L212)):** loops only over available qualified traits with the original weights; the unused tail weight is silently dropped.
**Impact:** Sparse/emerging profiles are under-scored — exactly the EC-18 bias against developing students.
**Fix:** After truncating `qualified`, rescale the used weights to sum 1.0.

### TIE-1 — Cascade structure differs (determinism OK) · ⚠️ PARTIAL · 🟡 MINOR
**Spec (§2.3 step 7):** Tier1 item-level → Tier2 cross-instrument → Tier3 locked order (R→I→A→S→E→C / Gardner / item-bank / Sr-no).
**Code:** Pager ranks careers by stable `suitability` sort ([Nav360:456](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L456)); the richer stanine→intel→ability→alphabetical cascade lives in the **legacy** `NavigatorCoreAnalysis`, not the pager path. No explicit cross-instrument Tier-2 / Sr-no Tier-3 for clusters.
**Behavioural:** EC-06 six-way tie produced **byte-identical** Top-9 across 5 runs — determinism holds, so risk is low; the *structure* simply isn't the spec's cascade.
**Fix:** Document the stable-sort tie order as the accepted Tier-3, or implement the cluster cascade tuple for TOP9-2.

### CSI-1 / CSI-2 — Core formula & sub-scores differ · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.3 step 8):** per cluster `csi = 0.40·P + 0.30·A + 0.20·I + 0.10·V`, where P/A/I = Σ over the cluster's required traits of `norm × rank-weight`.
**Code ([Nav360:341-375,443](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L341-L375)):** `suitability = 0.60·potentialMatch + 0.40·valuesMatch + aspBonus`; `potentialMatch` is a single blended number built from **level→fixed points** (HIGH=13.3 RIASEC/10 MI/10 Abil; MOD=8/6/6) × {1.0,0.6,0.3}. No separate P/A/I sub-scores, no `norm × weight`, no 0.40/0.30/0.20/0.10 split.
**Impact:** The headline percentage is a different equation; values weight is 40% (vs spec 10%), academics/intelligence weighting absent from the career score.
**Fix:** Replace `computePotentialMatch`/`computeSuitability` with the spec's four-component weighted CSI over per-cluster required traits.

### CSI-3 — Values denominator & conflict source wrong · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.3 step 8 / §8.2):** `base = 100 × (matched / 5)` (fixed /5), `penalty = 15 × conflict_count` against the cluster's `conflict_values` list, clamp [0,100].
**Code ([Nav360:386-415](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L386-L415)):** `matchScore = matched/spec.size() × 100` (denominator = student's selected count, not 5); conflicts detected by `career.name.contains(conflictString)` (a name substring match, not a values list); clamps only the lower bound.
**Impact:** A student who selects 3 values and matches 2 scores 67 (code) vs 40 (spec). EC-14/EC-32 (4-value) shift the denominator further.
**Fix:** Use fixed `/5` (or the WARN-02-adjusted denominator), and match against a real `conflict_values` set per cluster.

### TOP9-1 — 15 careers where 24 clusters required · ❌/🚫 · 🔴 CRITICAL
**Spec (§2.3 step 9, Master "24 Career Clusters"):** compute CSI for all **24** canonical clusters.
**Code ([Nav360CareerData:33-138](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360CareerData.java#L33-L138)):** catalog of **15** entries (cs-ai, engineering, science-maths, … sports-physical). 9 canonical clusters are simply absent from the candidate set.
**Impact:** Students can never be matched to a third of the official clusters; cross-school comparability breaks.
**Fix:** Load the 24-cluster table (with required RIASEC/MI/ability/values per cluster) as the candidate set.

### TOP9-2 / TOP9-3 — Cluster cascade & bottom suppression absent · 🚫 MISSING · 🟠 MAJOR
**Spec:** at rank 9/10 boundary apply cluster cascade A→F; if 4+ of Top-9 are below `csi_pct=50`, suppress the bottom tier.
**Code:** Stable sort decides 9/10; no `<50` suppression anywhere (the only `top9` use is CCI overlap, [Nav360:464](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L464)).
**Behavioural (EC-15):** Top-9 contained ≥4 entries below 50 (`49,48,47,47,39,38`) yet nothing was suppressed.
**Fix:** Add the cascade tuple sort and the "≥4 below 50 → drop bottom tier" presentation rule.

### CCI-1 — Different output type, bands, and no Insight skip · ❌ MISMATCH · 🔴 CRITICAL
**Spec (§2.3 step 10):** `cci = matched_aspirations / mapped_aspirations × 100`; bands ≥70 Clear / 40–69 Partial / <40 Mismatch; **skip for Insight**.
**Code ([Nav360:462-478](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L462-L478)):** returns enum `CciLevel{High,Moderate,Low}` from `matchTop3≥2→High`, `matchTop3==1||matchTop9≥1→Moderate`, else Low. No percentage, no 70/40 bands, and computed for **every** grade group.
**Behavioural:** Insight-grade fixtures (class "10"→9-10, but the engine never gates Insight) all returned a CCI value; EC-09 (unmapped aspirations, expected N/A) returned `Low`, not N/A.
**Fix:** Compute the percentage + bands; return N/A when no aspirations map; skip entirely for the 6-8 Insight stage.

### REL-1 — Reliability ×1.05 applied to the wrong quantity · ⚠️ PARTIAL · 🔴 CRITICAL
**Spec (§2.3 step 11):** `csi_final = clamp(round(csi_raw × completion_pct × 1.05), 0, 100)` — applied to each cluster CSI.
**Code ([Nav360:282-286](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L282-L286)):** the ×1.05 + clamp is applied to the internal **Potential score** (`potRaw × completionPct × 1.05`). The career `suitability` (the Top-9 percentages) receives **no** reliability adjustment, and `completionPct` is a method parameter defaulting to 1.0 — never derived from `(108−issues)/108`.
**Impact:** The numbers students actually see never get the reliability nudge; completion has no real input.
**Fix:** Move the `×completion_pct×1.05` clamp onto the career CSI, and compute `completion_pct` from cleaned-item counts (denominator 108 per EC-26's primary reading — note the spec/Excel conflict in §6).

### BAR-1 — No cell-position formula · 🚫 MISSING · 🟠 MAJOR
**Spec (§2.7.1):** `cell_position = clamp(ceil(csi_pct / 11.11), 1, 9)`.
**Code ([Nav360:421-428](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L421-L428)):** computes `suitability9 = max(1, round(suitability/100 × 9))` (round, not ceil; different mapping) and never emits it as a placeholder. e.g. csi=67 → spec cell `ceil(6.03)=7` ("Best Fit") vs code `round(6.03)=6`.
**Fix:** Implement `clamp(ceil(pct/11.11),1,9)` and bind it to a `pN_cell` placeholder.

### BAR-2 — Bar label keyed to rank, not fit · ❌ MISMATCH · 🟠 MAJOR (also a doc conflict — see §6)
**Code ([career-navigator.html:1218-1302](spring-social/src/main/resources/four-pager-template/career-navigator.html#L1218)):** the three label rows are **static**: career slots 1-3 always "MOST SUITED", 4-6 "MODERATELY SUITED", 7-9 "LEAST SUITED" — driven by **rank position**, not by `csi_pct`/cell. So a slot-1 career at 45% is labelled "MOST SUITED". This matches neither the Tech-Spec cell mapping (which is *ascending*: 1-3 LEAST … 7-9 MOST) nor the Excel labels (Worth Exploring/Strong Fit/Best Fit).
**Fix:** Drive the label from `cell_position` (BAR-1), and resolve the doc conflict in §6 before choosing the label text.

### FLG-1 — Registry largely unimplemented · ⚠️ PARTIAL · 🔴 CRITICAL
- **ERR-01/02/04, WARN-01/02:** never emitted in Java (depend on the missing gates VG-1/VG-2/cleaning).
- **BIAS-01..04:** emitted, wrong thresholds, no scoring effect (VG-3).
- **P-02 (Multi-Dominant):** not implemented — EC-07 (triple-High tie) produced no P-02.
- **P-03 (Flat Moderate):** **dead code** — the check at [Nav360:219-221](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L219-L221) sits inside the `else` branch where `hiR` is non-empty, guarded by `hiR.isEmpty()` (always false there). EC-06 (all-Moderate, expected P-03) produced **P-01** instead.
- **P-01/P-05/P-06:** fire on "no HIGH" rather than spec's "all LOW", so all-Moderate fixtures get them spuriously.
**Fix:** Wire ERR/WARN to the new gates; move the P-03 check out of the dead branch; change P-01/05/06 triggers to "all LOW"; add P-02.

### STG-1 — Stage variations incomplete · ⚠️ PARTIAL · 🟠 MAJOR
**Spec (§2.6):** Insight skips Section A and CCI; Page-4 actions sourced from stage-specific columns (Insight 2,3 / Subject 4,5 / Career 6,7).
**Code ([FourPager:41-45,542-548](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/FourPagerEngineService.java#L41-L45)):** `resolveVariant` selects INSIGHT/SUBJECT/CAREER by grade group, and actions come from hardcoded `ACTION_INSIGHT/SUBJECT/CAREER` maps (stage-specific in effect, though not from the Excel columns). But aspirations and CCI are populated for **all** stages — Insight is not special-cased, so Insight reports show a CCI the spec forbids and never swap in the motivation copy.
**Fix:** Gate aspiration/CCI population on `variant != INSIGHT`; render motivation copy for Insight.

### PH-1 — `pN_cell` placeholder absent · ⚠️ PARTIAL · 🟠 MAJOR
**Code ([FourPager:596-611](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/FourPagerEngineService.java#L596-L611)):** emits `career_N_name`, `career_N_pct`, `pN%`, `career_N_score`, `_desc`, `_tags` — but **no `pN_cell`** (consistent with BAR-1 missing). The percent placeholder carries `suitability`, which is the code's analog of `csi_final` but produced by the divergent CSI-1 formula and with no reliability adjustment.
**Fix:** Add `pN_cell` once BAR-1 exists.

### DEV-1 — Development plan · ❓ UNVERIFIABLE
A narrative/growth-area builder exists in `FourPagerEngineService`, but I did not locate code matching the precise spec rule (Top-1 cluster: Low required abilities→grow; non-High required RIASEC→explore; both empty→positive single line). Needs a focused read of the dev-sidebar builder to classify.

### ➕ EXTRA — "Potential / Preference score" construct
The engine computes a 0–100 **Potential score** (Personality 25 + Intelligence 25 + Ability 30 + Academic 20) and a Preference score ([Nav360:185-337](spring-social/src/main/java/com/kccitm/api/service/b2c/pager/Navigator360EngineService.java#L185-L337)). These appear nowhere in the v5 spec's 12-step pipeline. They are where the WT-1/WT-2 weights and the REL-1 ×1.05 actually live — i.e. the spec's weighting constants were wired into a non-spec construct rather than into the CSI.

---

## 4. Fixture Results (32 records via the verified execution proxy)

Legend: **PASS** = engine behaviour matches the fixture's expected flag/behaviour; **FAIL** = diverges. "Expected" from the fixture `Status` column + `EdgeCases` register.

| EC | Expected | Actual (engine) | Verdict |
|---|---|---|---|
| EC-01 | ERR-01, invalid, no report | No ERR; full report; flags P-01,P-05,P-06,P-10 | ❌ FAIL (no validity gate) |
| EC-02 | ERR-02, invalid | Same as EC-01, no ERR | ❌ FAIL |
| EC-03 | BIAS-01, personality suppressed+reweight | BIAS-01 emitted **but** full scores, no suppression; +spurious P-05/06/10 | ❌ FAIL (flag only) |
| EC-04 | 2+ bias → HARD FAIL, cover-only, Top-9 empty | BIAS-01+BIAS-03 emitted; **full Top-9 returned** | ❌ FAIL |
| EC-05 | P-01+P-05+P-06, Top-9 suppressed | P-01+P-05+P-06 ✓ **but** Top-9 not suppressed; +spurious BIAS-02,P-10 | ⚠️ PARTIAL (flags yes, suppression no) |
| EC-06 | P-03, HALF gate, deterministic | **P-01 not P-03** (dead-code bug); deterministic ✓ (5× identical) | ❌ FAIL (wrong flag) |
| EC-07 | P-02 (multi-dominant) | No P-02 (unimplemented); only P-10 | ❌ FAIL |
| EC-08 | cluster cascade resolves | Resolved by stable sort (no cascade) | ⚠️ PARTIAL |
| EC-09 | CCI = N/A | CCI = Low (not N/A) | ❌ FAIL |
| EC-10 | P-07 (CCI<40%) | CCI enum "Moderate"; P-07 not raised | ❌ FAIL |
| EC-11 | P-10 only, no scoring effect | P-10 raised ✓ (+spurious P-01/05/06) | ⚠️ PARTIAL |
| EC-12 | VALID at 3 issues; no WARN-01 at 90% | Scored (no gate to violate); WARN-01 never exists | ⚠️ N/A (gate absent) |
| **EC-13** | raw15→High, raw12→Mod (band test) | **I=15→Moderate** | ❌ FAIL (NORM-2) |
| EC-14 | P-08, values clamp ≥0 | P-08 raised ✓; values formula divergent (CSI-3) | ⚠️ PARTIAL |
| EC-15 | bottom tier suppressed (≥4 <50) | ≥4 below 50 present; no suppression | ❌ FAIL (TOP9-3) |
| EC-16 | Tier-3 canonical fallback | Stable-sort fallback; deterministic | ⚠️ PARTIAL |
| EC-17 | WARN-02, values panel blank | No WARN-02; full panel | ❌ FAIL (VG-2) |
| EC-18 | renormalise weights | No renormalisation (WT-3) | ❌ FAIL |
| EC-29 | ERR-04, no report | No ERR; full report | ❌ FAIL (VG-2) |
| EC-30 | **no flags** (positive control) | Emits P-10 (spurious) | ❌ FAIL (positive control trips) |
| EC-31 | WARN-02 (A=3) | No WARN-02 | ❌ FAIL |
| EC-32 | WARN-02 (B=4) | No WARN-02 | ❌ FAIL |

> Remaining EC-19/20/21/23/24/25/26/27/28 are spec-gap/UX cases; observed behaviour recorded in the run log — none of the gate/flag behaviours they probe are implemented, consistent with the findings above.

**Determinism check (EC-06):** 5 identical runs → identical Top-9 order
`engineering:57 | science-maths:56 | cs-ai:55 | architecture-design:49 | finance-banking:48 | law:47 | management-entrepreneurship:47 | media-communication:39 | life-sciences-medicine:38`. Determinism **holds**, but note this ranks 15 careers, not 24 clusters, and the equal-suitability pair (law/management at 47) is broken by stable catalog order, not the spec cascade.

---

## 5. Worked Example — "Aarav Sharma" (Tech Spec §2.3, Career stage)

Input RIASEC raws: R=17, I=18, A=11, S=11, E=12, C=14.

| Step | Spec expectation | Code actual | Diverges? |
|---|---|---|---|
| Bands | H,H,L,L,M,M | R17→H, I18→H, A11→L, S11→L, E12→M, C14→M | ✅ same (these raws don't hit the 15/6 boundary) |
| Top-3 personality | [I, R, C] | sort by normPct → [I(100), R(88.9), C(55.6)] | ✅ same |
| Gate | 2 High → OPEN ×1.00 | 2 High → gateMul 1.00 (on Potential score only) | ⚠️ gate scopes differ |
| **Step 8 CSI (Engineering & Tech)** | `csi_raw = 0.40·85.1 + 0.30·78 + 0.20·82 + 0.10·80 = 81.8` | No cluster CSI exists; "engineering" career scored via `0.60·potMatch + 0.40·valMatch + aspBonus` | ❌ different formula |
| **Step 11 reliability** | `csi_final = round(81.8 × 1.0 × 1.05) = 86` → **displays 87%** | career `suitability` gets **no ×1.05**; would round to **82** even if the raw were 81.8 | ❌ ~5-pt gap from misplaced multiplier |
| Bar cell | `ceil(87/11.11)=8` → "Best Fit"/green | no cell computed; label static by rank | ❌ missing |

**Conclusion:** the worked example **cannot be reproduced** — it diverges first at Step 8 (the CSI equation does not exist in code) and again at Step 11 (the ×1.05 reliability nudge is applied to a different, non-spec "Potential score", never to the career percentage). Band classification and Top-3 personality (the early, shared steps) do match for this particular input.

---

## 6. Open Conflicts (doc-vs-doc — for a human to decide)

1. **BAR-2 band labels.** Tech Spec §2.7.1 says cells 1-3 "LEAST SUITED" / 4-6 "MODERATE SUITED" / 7-9 "MOST SUITED" (ascending with fit). Master Excel "8. Page 4 Bar Mapping" says 1-3 "Worth Exploring" / 4-6 "Strong Fit" / 7-9 "Best Fit". Per the source-of-truth hierarchy (**Master Excel wins**), the Excel labels should govern. The code uses a **third** variant ("MOST/MODERATELY/LEAST SUITED" keyed to rank, descending) that matches neither. **Decision needed:** confirm Excel labels as canonical, then drive them from `cell_position`.

2. **EC-26 completion_pct denominator.** The Tech Spec pseudo-code and the EdgeCases "Proposed resolution" say keep denominator **108** after bias suppression; the EdgeCases v4.2-update cell says keep **84** ("aspirations not mentioned in insight"). Internal contradiction within source ③. **Decision needed** before REL-1 is implemented.

3. **EC-18 weight renormalisation.** Tech Spec step 6 mandates renormalisation; EdgeCases marks it "Resolved in 4.2" with a gating-rule note ("moderate moderate low allowed; moderate low low close the gate") that is not obviously the same rule. **Decision needed** on the exact gate/renormalise interaction.

---

## 7. Appendix — Audit Method
- Spec parsed with a stdlib-only reader (`zipfile`+`xml.etree`; `/tmp/specread.py`) — no external deps available (no pip/pandoc).
- Spec ledger built from the docx (§2.1–2.7) + Master sheets (4. Scoring Pipeline, Score Interpretation, 6/8/9 placeholder/bar/flag, Gating rules) + EdgeCases register + the fixture template.
- Code located via four scoped Explore passes; all quoted lines re-read in the Java source.
- Behavioural proxy: TS engine confirmed identical to Java on stanine/normalize/level/grade/suitability/catalog/flags, then executed over 32 fixtures (`/tmp/harness.mts`) + a 5× determinism run. The TS engine itself is **dead code**; it was used only to exercise the shared logic, and every divergence is cited to live Java source.
- **No implementation code was modified.** All fixes above are proposals.
