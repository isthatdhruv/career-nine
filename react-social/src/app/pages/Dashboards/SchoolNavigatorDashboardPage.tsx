import { FC, useEffect } from "react";

const NAVIGATOR_DASHBOARD_CSS = String.raw`
/* ── TOKENS ─────────────────────────────────────────── */
:root {
  --dk:#05160F; --mg:#0B3022; --t:#0D5C42; --tm:#10866A; --tl:#1DB88F;
  --t1:#C6EFE3; --t05:#EDF9F5;
  --a:#B85C0D; --am:#E07B25; --al:#F9C57A; --a1:#FEE9C9; --a05:#FFF7ED;
  --b:#1A3866; --bm:#2A5CB8; --bl:#6B9FE8; --b1:#D1E4FB; --b05:#EEF5FF;
  --r:#8C1515; --rm:#C0392B; --rl:#E88080; --r1:#FCE0E0; --r05:#FFF4F4;
  --g:#0F5132; --gm:#198754; --gl:#6DCF9E; --g1:#D4EDDA; --g05:#F0FBF5;
  --pu:#4B2088; --pum:#7B4FCF; --pul:#B8A0F0; --pu1:#EDE0FF;
  --wh:#FFFFFF; --off:#F6FAF8; --bg:#EEF5F1; --bd:#C8DDD7; --mu:#527066;
  --ink:#0D1F1A; --serif:'DM Serif Display',Georgia,serif;
  --sans:'DM Sans',system-ui,sans-serif; --mono:'JetBrains Mono',monospace;
  --rad:14px; --rads:8px; --sh:0 2px 16px rgba(0,0,0,.07); --shl:0 8px 40px rgba(0,0,0,.13);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--ink);font-size:13px;line-height:1.6;min-height:100vh}

/* ── TOP BAR ─────────────────────────────────────────── */
.topbar{background:var(--dk);height:52px;display:flex;align-items:center;padding:0 24px;gap:16px;position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(255,255,255,.08)}
.logo{font-family:var(--serif);color:var(--wh);font-size:16px;letter-spacing:-.2px}
.logo span{color:var(--tl)}
.school-name{font-size:11px;color:rgba(255,255,255,.4);margin-left:4px;border-left:1px solid rgba(255,255,255,.12);padding-left:12px}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.role-tabs{display:flex;gap:3px;background:rgba(255,255,255,.07);padding:3px;border-radius:8px}
.rtab{padding:5px 14px;border-radius:6px;border:none;background:none;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:all .2s;letter-spacing:.2px}
.rtab.active{background:var(--tm);color:#fff}
.cci-badge{padding:4px 12px;border-radius:20px;background:rgba(29,184,143,.15);color:var(--tl);font-size:10px;font-weight:600;border:1px solid rgba(29,184,143,.25)}

/* ── SCREENS ─────────────────────────────────────────── */
.screen{display:none;padding:20px 24px 60px;max-width:1180px;margin:0 auto}
.screen.active{display:block}

/* ── SECTION HEADERS ─────────────────────────────────── */
.sh{display:flex;align-items:center;gap:10px;margin:22px 0 14px}
.sh-title{font-family:var(--serif);font-size:17px;color:var(--dk);letter-spacing:-.2px}
.sh-sub{font-size:11px;color:var(--mu);margin-top:1px}
.sh-pill{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:4px}
.sph-t{background:var(--t1);color:var(--mg)} .sph-a{background:var(--a1);color:var(--a)} .sph-r{background:var(--r1);color:var(--r)}

/* ── GRIDS ───────────────────────────────────────────── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}

/* ── CARDS ───────────────────────────────────────────── */
.card{background:var(--wh);border-radius:var(--rad);border:1px solid var(--bd);overflow:hidden}
.card-head{padding:12px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.card-title{font-size:12px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.5px}
.card-body{padding:14px 16px}

/* KPI CARDS */
.kpi{background:var(--wh);border-radius:var(--rad);border:1px solid var(--bd);padding:16px 18px;position:relative;overflow:hidden;transition:box-shadow .2s}
.kpi:hover{box-shadow:var(--sh)}
.kpi::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px}
.kpi.teal::after{background:var(--tm)} .kpi.amber::after{background:var(--am)}
.kpi.red::after{background:var(--rm)} .kpi.blue::after{background:var(--bm)}
.kpi.green::after{background:var(--gm)} .kpi.pur::after{background:var(--pum)}
.kpi-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--mu);margin-bottom:6px}
.kpi-value{font-family:var(--serif);font-size:32px;color:var(--dk);line-height:1;margin-bottom:3px}
.kpi-value.teal{color:var(--tm)} .kpi-value.red{color:var(--rm)} .kpi-value.amber{color:var(--a)} .kpi-value.green{color:var(--gm)}
.kpi-sub{font-size:11px;color:var(--mu)}
.kpi-action{font-size:10px;color:var(--tl);margin-top:8px;cursor:pointer;font-weight:600;text-decoration:underline;text-decoration-color:transparent;transition:.2s}
.kpi-action:hover{text-decoration-color:var(--tl)}

/* PILLS */
.pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.p-hi{background:var(--g1);color:var(--g)} .p-md{background:var(--a1);color:var(--a)}
.p-lo{background:var(--r1);color:var(--r)} .p-t{background:var(--t1);color:var(--mg)}
.p-b{background:var(--b1);color:var(--b)} .p-pu{background:var(--pu1);color:var(--pu)}

/* INLINE BARS */
.ibar{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.ibg{flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden}
.ibf{height:100%;border-radius:3px}
.ibf.t{background:var(--tm)} .ibf.a{background:var(--am)} .ibf.r{background:var(--rm)}
.ibf.g{background:var(--gm)} .ibf.b{background:var(--bm)} .ibf.pu{background:var(--pum)}
.ib-lbl{font-size:11px;font-weight:500;min-width:130px}
.ib-pct{font-size:11px;font-weight:600;min-width:38px;text-align:right;color:var(--mu)}

/* ── SURVEY INSIGHT PANEL ────────────────────────────── */
.insight-strip{background:linear-gradient(135deg,var(--dk),var(--mg));border-radius:var(--rad);padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;gap:14px;position:relative;overflow:hidden}
.insight-strip::before{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(29,184,143,.08)}
.is-icon{font-size:22px;flex-shrink:0}
.is-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.4);margin-bottom:3px}
.is-title{font-family:var(--serif);font-size:15px;color:#fff;margin-bottom:2px}
.is-sub{font-size:11px;color:rgba(255,255,255,.5)}
.is-metric{text-align:right;flex-shrink:0}
.is-n{font-family:var(--serif);font-size:28px;color:var(--tl);line-height:1}
.is-nl{font-size:10px;color:rgba(255,255,255,.4)}

/* PROBLEM → INSIGHT ROWS */
.problem-grid{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.prob-row{background:var(--wh);border-radius:var(--rads);border:1px solid var(--bd);display:grid;grid-template-columns:24px 220px 1fr auto;gap:0;align-items:stretch;overflow:hidden}
.prob-sev{width:24px;flex-shrink:0}
.prob-sev.hi{background:var(--rm)} .prob-sev.md{background:var(--am)} .prob-sev.lo{background:var(--gm)}
.prob-label{padding:12px 14px;border-right:1px solid var(--bd)}
.prob-name{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:2px}
.prob-area{font-size:10px;color:var(--mu)}
.prob-insight{padding:12px 14px;display:flex;flex-direction:column;justify-content:center}
.prob-insight-title{font-size:11px;font-weight:600;color:var(--tm);margin-bottom:2px}
.prob-insight-text{font-size:11px;color:var(--mu);line-height:1.5}
.prob-metric{padding:12px 16px;border-left:1px solid var(--bd);display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:90px;background:var(--off)}
.prob-n{font-family:var(--serif);font-size:22px;line-height:1}
.prob-n.red{color:var(--rm)} .prob-n.amber{color:var(--a)} .prob-n.green{color:var(--gm)}
.prob-nl{font-size:9px;color:var(--mu);text-align:center}

/* ── STUDENT TABLE ───────────────────────────────────── */
.tbl-wrap{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{background:var(--mg);color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap}
.tbl td{padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:middle}
.tbl tr:nth-child(even) td{background:var(--off)}
.tbl tr:hover td{background:var(--t05);cursor:pointer}
.tbl tr.flagged td{background:var(--r05)}
.tbl tr.flagged:hover td{background:var(--r1)}

/* ── CAREER CLUSTER BARS ─────────────────────────────── */
.cluster-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--bd)}
.cluster-row:last-child{border-bottom:none}
.cr-type{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}
.cr-name{font-size:11px;font-weight:500;width:110px;flex-shrink:0}
.cr-bar-w{flex:1}
.cr-bg{height:8px;background:var(--bd);border-radius:4px;overflow:hidden}
.cr-fill{height:100%;border-radius:4px}
.cr-pct{font-size:11px;font-weight:600;width:36px;text-align:right;flex-shrink:0}
.cr-careers{font-size:10px;color:var(--mu);margin-top:2px}

/* ── NEP COMPLIANCE ──────────────────────────────────── */
.nep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.nep-item{border-radius:var(--rads);padding:10px 12px;border:1px solid}
.nep-item.pass{background:var(--g05);border-color:var(--g1)}
.nep-item.warn{background:var(--a05);border-color:var(--a1)}
.nep-item.fail{background:var(--r05);border-color:var(--r1)}
.nep-icon{font-size:14px;margin-bottom:4px}
.nep-name{font-size:11px;font-weight:600;margin-bottom:2px}
.nep-item.pass .nep-name{color:var(--g)} .nep-item.warn .nep-name{color:var(--a)} .nep-item.fail .nep-name{color:var(--r)}
.nep-detail{font-size:10px;color:var(--mu);line-height:1.4}

/* ── STUDENT DASHBOARD ───────────────────────────────── */
.student-banner{background:linear-gradient(135deg,var(--dk),var(--mg));border-radius:var(--rad);padding:20px 24px;display:flex;align-items:center;gap:16px;margin-bottom:18px;position:relative;overflow:hidden}
.student-banner::after{content:'';position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(29,184,143,.07)}
.stu-av{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--tm),var(--tl));display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:20px;color:#fff;flex-shrink:0}
.stu-name{font-family:var(--serif);font-size:20px;color:#fff}
.stu-meta{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px}
.stu-cci{border-radius:30px;border:1.5px solid var(--tl);padding:8px 16px;text-align:center;flex-shrink:0}
.stu-cci-lbl{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.8px}
.stu-cci-val{font-family:var(--serif);font-size:17px;color:var(--tl)}

/* POTENTIAL / PREFERENCE PANELS */
.dual{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.panel{background:var(--wh);border-radius:var(--rad);border:1px solid var(--bd);overflow:hidden}
.ph{padding:12px 16px;display:flex;align-items:center;gap:8px}
.ph.pot{background:var(--mg);} .ph.pref{background:var(--a);}
.ph-icon{font-size:16px}
.ph-title{font-family:var(--serif);font-size:14px;color:#fff}
.ph-sub{font-size:10px;color:rgba(255,255,255,.5);margin-top:1px}
.sec{padding:12px 16px;border-bottom:1px solid var(--bd)}
.sec:last-child{border-bottom:none}
.sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px}
.sec-lbl.t{color:var(--tm)} .sec-lbl.a{color:var(--a)}
.riasec-row{display:flex;gap:5px;margin-bottom:6px}
.rtype{border-radius:6px;padding:6px 8px;text-align:center;flex:1;border:1.5px solid transparent}
.rtype.hi{background:var(--t05);border-color:var(--t1)} .rtype.md{background:var(--off)} .rtype.lo{background:var(--r05);border-color:var(--r1)}
.rc{font-family:var(--serif);font-size:17px;font-weight:700;color:var(--mg)} .rtype.md .rc{color:var(--mu)} .rtype.lo .rc{color:var(--r)}
.rn{font-size:9px;color:var(--mu);text-transform:uppercase;letter-spacing:.3px}
.rs{font-size:11px;font-weight:600;color:var(--tm)} .rtype.md .rs{color:var(--mu)} .rtype.lo .rs{color:var(--rl)}
.mi-bar{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.mi-lbl{font-size:11px;font-weight:500;flex:1}
.mi-bg{width:90px;height:5px;background:var(--bd);border-radius:3px;overflow:hidden;flex-shrink:0}
.mi-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--tm),var(--tl))}
.mi-pct{font-size:11px;font-weight:600;color:var(--tm);width:32px;text-align:right;flex-shrink:0}
.val-chips{display:flex;flex-wrap:wrap;gap:5px}
.val-chip{font-size:10px;padding:3px 9px;border-radius:20px;background:var(--a05);color:var(--a);border:1px solid var(--a1);font-weight:500}
.asp-chip{font-size:10px;padding:3px 9px;border-radius:20px;background:var(--t05);color:var(--mg);border:1px solid var(--t1);font-weight:500}
.cc-chips{display:flex;flex-wrap:wrap;gap:5px}
.cc-on{font-size:10px;padding:3px 9px;border-radius:6px;background:var(--a05);border:1.5px solid var(--al);color:var(--a);font-weight:500}
.cc-off{font-size:10px;padding:3px 9px;border-radius:6px;background:var(--off);color:var(--mu);border:1px solid var(--bd)}

/* CONVERGENCE */
.conv{background:var(--dk);border-radius:var(--rad);padding:18px 20px;display:grid;grid-template-columns:1fr 90px 1fr;gap:14px;align-items:center;margin-bottom:16px;position:relative;overflow:hidden}
.conv::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(29,184,143,.1),transparent 60%)}
.cv-side{text-align:center}
.cv-lbl{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.35);margin-bottom:4px}
.cv-score{font-family:var(--serif);font-size:34px;line-height:1}
.cv-score.t{color:var(--tl)} .cv-score.a{color:var(--al)}
.cv-sub{font-size:10px;color:rgba(255,255,255,.3);margin-top:3px}
.cv-ring{width:82px;height:82px;border-radius:50%;border:2px solid rgba(255,255,255,.13);background:rgba(255,255,255,.04);display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 5px}
.cv-pct{font-family:var(--serif);font-size:22px;color:#fff;line-height:1}
.cv-rl{font-size:8px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.7px}
.cv-msg{font-size:10px;color:var(--tl);font-weight:600;text-align:center}

/* CAREER CARDS */
.career-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.cc{background:var(--wh);border-radius:var(--rad);overflow:hidden;border:1px solid var(--bd);transition:transform .2s,box-shadow .2s}
.cc:hover{transform:translateY(-3px);box-shadow:var(--shl)}
.cc-head{padding:14px 15px 11px;position:relative}
.r1 .cc-head{background:linear-gradient(135deg,#041a10,var(--mg))}
.r2 .cc-head{background:linear-gradient(135deg,#102038,var(--b))}
.r3 .cc-head{background:linear-gradient(135deg,#2a0a00,var(--a))}
.cc-rank{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;margin-bottom:7px;display:inline-block}
.r1 .cc-rank{background:rgba(255,215,0,.2);color:#FFD700}
.r2 .cc-rank{background:rgba(192,192,192,.2);color:#D0D0D0}
.r3 .cc-rank{background:rgba(205,127,50,.2);color:#E8A060}
.cc-name{font-family:var(--serif);font-size:15px;color:#fff;margin-bottom:3px;line-height:1.2}
.cc-tag{font-size:10px;color:rgba(255,255,255,.4);line-height:1.4}
.cc-suit{position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.14);display:flex;flex-direction:column;align-items:center;justify-content:center}
.cc-sn{font-family:var(--serif);font-size:15px;color:#fff;line-height:1}
.cc-sd{font-size:8px;color:rgba(255,255,255,.35)}
.cc-body{padding:11px 15px 13px}
.cc-why{font-size:11px;color:var(--mu);line-height:1.65;margin-bottom:8px}
.cc-drivers{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px}
.dr-p{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--t05);color:var(--mg);border:1px solid var(--t1);font-weight:500}
.dr-v{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--a05);color:var(--a);border:1px solid var(--a1);font-weight:500}
.cc-next{background:var(--t05);border-left:3px solid var(--tm);border-radius:0 6px 6px 0;padding:7px 9px;font-size:10px;color:var(--mg);line-height:1.55}

/* ── COUNSELLOR ──────────────────────────────────────── */
.co-layout{display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start}
.student-list{background:var(--wh);border-radius:var(--rad);border:1px solid var(--bd);overflow:hidden;height:calc(100vh - 140px);display:flex;flex-direction:column}
.sl-head{padding:10px 14px;background:var(--mg);display:flex;align-items:center;gap:8px}
.sl-title{font-size:12px;font-weight:600;color:#fff;flex:1}
.sl-count{font-size:10px;background:rgba(255,255,255,.15);color:#fff;padding:2px 7px;border-radius:10px}
.sl-search{padding:10px 12px;border-bottom:1px solid var(--bd)}
.sl-search input{width:100%;border:1px solid var(--bd);border-radius:6px;padding:6px 10px;font-size:11px;font-family:var(--sans);outline:none;background:var(--off)}
.sl-body{flex:1;overflow-y:auto}
.sl-item{padding:10px 14px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .15s;display:flex;align-items:center;gap:10px}
.sl-item:hover{background:var(--t05)}
.sl-item.active{background:var(--t05);border-left:3px solid var(--tm)}
.sl-item.flagged{background:var(--r05)}
.sl-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--tm),var(--tl));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.sl-info{flex:1;min-width:0}
.sl-name{font-size:12px;font-weight:600;color:var(--ink)}
.sl-grade{font-size:10px;color:var(--mu)}
.student-detail{background:var(--wh);border-radius:var(--rad);border:1px solid var(--bd);overflow:hidden}
.sd-tabs{display:flex;border-bottom:1px solid var(--bd);background:var(--off)}
.sdtab{padding:10px 16px;font-size:11px;font-weight:600;color:var(--mu);cursor:pointer;border-bottom:2px solid transparent;transition:all .2s}
.sdtab.active{color:var(--tm);border-bottom-color:var(--tm)}
.sd-content{padding:16px}

/* ── TEACHER ─────────────────────────────────────────── */
.class-select{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.cs-btn{padding:7px 16px;border:1.5px solid var(--bd);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);background:var(--wh);color:var(--mu);transition:all .2s}
.cs-btn.active{background:var(--mg);color:#fff;border-color:var(--mg)}
.strategy-card{background:var(--wh);border-radius:var(--rads);border:1px solid var(--bd);padding:12px 14px;display:flex;gap:10px}
.sc-icon{font-size:18px;flex-shrink:0}
.sc-title{font-size:12px;font-weight:600;color:var(--ink);margin-bottom:3px}
.sc-body{font-size:11px;color:var(--mu);line-height:1.55}
.flag-row{display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--r05);border-radius:var(--rads);border:1px solid var(--r1);margin-bottom:6px}
.flag-dot{width:8px;height:8px;border-radius:50%;background:var(--rm);flex-shrink:0}
.flag-name{font-size:12px;font-weight:600;color:var(--r);flex:1}
.flag-badge{font-size:10px;padding:2px 8px;background:var(--r1);color:var(--r);border-radius:10px}

/* ── MODALS ──────────────────────────────────────────── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:none;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:#fff;border-radius:var(--rad);width:580px;max-height:80vh;overflow-y:auto;box-shadow:var(--shl)}
.modal-head{background:var(--mg);padding:14px 18px;display:flex;align-items:center;justify-content:space-between}
.modal-title{font-family:var(--serif);font-size:16px;color:#fff}
.modal-close{background:none;border:none;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;line-height:1;font-family:var(--sans)}
.modal-body{padding:18px}

/* ── USP CARD ────────────────────────────────────────── */
.usp-card{background:linear-gradient(135deg,var(--dk),#0d2e1a);border-radius:var(--rad);padding:20px 24px;color:#fff;position:relative;overflow:hidden}
.usp-card::before{content:'';position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;background:rgba(29,184,143,.08)}
.usp-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:rgba(255,255,255,.35);margin-bottom:8px}
.usp-title{font-family:var(--serif);font-size:20px;color:#fff;margin-bottom:8px;line-height:1.3}
.usp-body{font-size:12px;color:rgba(255,255,255,.55);line-height:1.65;margin-bottom:14px}
.usp-tags{display:flex;gap:6px;flex-wrap:wrap}
.usp-tag{font-size:10px;padding:3px 10px;border-radius:20px;background:rgba(29,184,143,.15);color:var(--tl);border:1px solid rgba(29,184,143,.25)}

/* ── MISC ────────────────────────────────────────────── */
.divider{height:1px;background:var(--bd);margin:16px 0}
.mono{font-family:var(--mono);font-size:11px}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .4s ease both}
.fu2{animation:fadeUp .4s .08s ease both}
.fu3{animation:fadeUp .4s .16s ease both}
@keyframes fillbar{from{width:0}}
.fill-anim .ibf,.fill-anim .cr-fill,.fill-anim .mi-fill{animation:fillbar .9s ease both}

@media(max-width:760px){.g2,.g3,.g4,.dual,.career-grid,.co-layout{grid-template-columns:1fr}.prob-row{grid-template-columns:10px 1fr}}

/* ── PDF PRINT STYLES ── */
@media print {
  .topbar,.role-tabs,.cci-badge,.sh-pill { display:none!important }
  .screen { display:block!important; padding:0; max-width:100% }
  #screen-principal,#screen-teacher,#screen-counsellor { display:none!important }
  #screen-student { display:block!important }
  .student-banner { break-inside:avoid; background:linear-gradient(135deg,#062118,#0B3022)!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .dual { display:grid!important; grid-template-columns:1fr 1fr!important; gap:10px }
  .panel { break-inside:avoid; border:1px solid #C8DDD7!important }
  .ph.pot { background:#0B3022!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .ph.pref { background:#B85C0D!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .conv { background:#062118!important; -webkit-print-color-adjust:exact; print-color-adjust:exact; break-inside:avoid }
  .career-grid { grid-template-columns:repeat(3,1fr)!important }
  .cc { break-inside:avoid }
  .r1 .cc-head { background:linear-gradient(135deg,#041a10,#0A4035)!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .r2 .cc-head { background:linear-gradient(135deg,#102038,#1A3866)!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .r3 .cc-head { background:linear-gradient(135deg,#2a0a00,#B85C0D)!important; -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .kpi-action,.sdtab,.sd-tabs,.student-list,.co-layout { display:none!important }
  .ibf,.cr-fill,.mi-fill { -webkit-print-color-adjust:exact; print-color-adjust:exact }
  body { font-size:11px; background:#fff!important }
  @page { margin:14mm; size:A4 }
}
`;

const NAVIGATOR_DASHBOARD_BODY = String.raw`

<!-- ══ TOP BAR ══ -->
<div class="topbar">
  <div class="logo">Navigator <span>360</span></div>
  <div class="school-name">Global Public School, Mumbai &nbsp;·&nbsp; AY 2024–25</div>
  <div class="topbar-right">
    <span class="cci-badge">High CCI: 31%</span>
    <div class="role-tabs">
      <button class="rtab active" onclick="switchRole('principal',this)">Principal</button>
      <button class="rtab" onclick="switchRole('teacher',this)">Teacher</button>
      <button class="rtab" onclick="switchRole('counsellor',this)">Counsellor</button>
      <button class="rtab" onclick="switchRole('student',this)">Student</button>
    </div>
  </div>
</div>

<!-- ══════════════════════════ PRINCIPAL ══════════════════════════ -->
<div id="screen-principal" class="screen active">

  <!-- DISCOVERY SURVEY INSIGHT STRIP -->
  <div class="insight-strip fu">
    <div class="is-icon">📋</div>
    <div style="flex:1">
      <div class="is-lbl">Discovery Survey Activated</div>
      <div class="is-title">Your school flagged 7 active challenges — Navigator 360 has data on all of them</div>
      <div class="is-sub">Scroll down to see what the assessment reveals about each problem your team identified</div>
    </div>
    <div class="is-metric">
      <div class="is-n">487</div>
      <div class="is-nl">Students assessed</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="g4 fu2">
    <div class="kpi teal">
      <div class="kpi-label">Career Clarity Index</div>
      <div class="kpi-value teal">31%</div>
      <div class="kpi-sub"><span class="pill p-lo">↓ 8% vs target</span> High CCI</div>
      <div class="kpi-action" onclick="openModal('cciModal')">See grade-wise breakdown →</div>
    </div>
    <div class="kpi red">
      <div class="kpi-label">Stream Mismatch Rate</div>
      <div class="kpi-value red">42%</div>
      <div class="kpi-sub">Students in mismatched streams</div>
      <div class="kpi-action" onclick="openModal('streamModal')">See class-wise heatmap →</div>
    </div>
    <div class="kpi amber">
      <div class="kpi-label">At-Risk Students</div>
      <div class="kpi-value amber">63</div>
      <div class="kpi-sub">Flagged for counsellor attention</div>
      <div class="kpi-action" onclick="openModal('riskModal')">View flagged list →</div>
    </div>
    <div class="kpi green">
      <div class="kpi-label">NEP 2020 Compliance</div>
      <div class="kpi-value green">5/8</div>
      <div class="kpi-sub">Criteria met &nbsp;·&nbsp; 3 gaps remain</div>
      <div class="kpi-action" onclick="openModal('nepModal')">See full checklist →</div>
    </div>
  </div>

  <div class="g2 fu3">

    <!-- PROBLEM → INSIGHT PANEL -->
    <div>
      <div class="sh"><div class="sh-title">Your Discovery Survey → What Navigator 360 Found</div></div>
      <div class="problem-grid">

        <div class="prob-row">
          <div class="prob-sev hi"></div>
          <div class="prob-label">
            <div class="prob-name">Students choose streams under parent pressure</div>
            <div class="prob-area">Section C — Stream Selection</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">RIASEC vs Stream Alignment Score</div>
            <div class="prob-insight-text">42% of Gr 11 students are in streams that conflict with their top RIASEC type. Science stream has the highest mismatch: 38% have Social or Artistic dominant types.</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n red">42%</div>
            <div class="prob-nl">Stream mismatch</div>
          </div>
        </div>

        <div class="prob-row">
          <div class="prob-sev hi"></div>
          <div class="prob-label">
            <div class="prob-name">No structured career counselling currently offered</div>
            <div class="prob-area">Section C — Career Counselling</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">CCI Distribution Across Cohort</div>
            <div class="prob-insight-text">Only 31% of students show High CCI. 43% are Low or None — they have no alignment between what they want and what they're naturally suited for.</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n red">43%</div>
            <div class="prob-nl">Low / No CCI</div>
          </div>
        </div>

        <div class="prob-row">
          <div class="prob-sev hi"></div>
          <div class="prob-label">
            <div class="prob-name">Difficult to identify at-risk students early</div>
            <div class="prob-area">Section C — Student Wellbeing</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">Psychometric Flags (P-01 to P-10)</div>
            <div class="prob-insight-text">63 students have active clinical flags — 18 show undifferentiated personality (P-01), 11 show all-ability-low (P-06), 34 have aspiration-suitability mismatch (P-07).</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n red">63</div>
            <div class="prob-nl">Active flags</div>
          </div>
        </div>

        <div class="prob-row">
          <div class="prob-sev md"></div>
          <div class="prob-label">
            <div class="prob-name">Teacher training is generic, not student-data-driven</div>
            <div class="prob-area">Section C — Teacher Development</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">Class Intelligence Profiles Available</div>
            <div class="prob-insight-text">Grade 9 dominant MI: Logical-Mathematical (62%). Grade 10: Interpersonal (54%). These require different teaching styles. Mismatch to current pedagogy evident.</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n amber">6</div>
            <div class="prob-nl">Class profiles ready</div>
          </div>
        </div>

        <div class="prob-row">
          <div class="prob-sev md"></div>
          <div class="prob-label">
            <div class="prob-name">School lacks distinctive identity for admissions</div>
            <div class="prob-area">Section C — School Positioning</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">Your School's Natural Talent Profile</div>
            <div class="prob-insight-text">65% of your students are Investigative-Realistic types. Your school naturally cultivates analytical, research-oriented students. This is a defensible USP for STEM admissions.</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n amber">IR</div>
            <div class="prob-nl">Dominant type</div>
          </div>
        </div>

        <div class="prob-row">
          <div class="prob-sev lo"></div>
          <div class="prob-label">
            <div class="prob-name">NEP 2020 compliance evidence is missing</div>
            <div class="prob-area">Section C — NEP Compliance</div>
          </div>
          <div class="prob-insight">
            <div class="prob-insight-title">5 of 8 HPC Criteria Now Documented</div>
            <div class="prob-insight-text">Navigator 360 provides documented multi-dimensional assessment for Cognitive, Social-Emotional, and Values dimensions. 3 gaps remain: Experiential, Physical, and Arts.</div>
          </div>
          <div class="prob-metric">
            <div class="prob-n green">5/8</div>
            <div class="prob-nl">Criteria met</div>
          </div>
        </div>

      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div>
      <!-- CAREER CLUSTER DISTRIBUTION -->
      <div class="sh"><div class="sh-title">Career Cluster Distribution</div><div class="sh-sub">What your 487 students are naturally suited for</div></div>
      <div class="card">
        <div class="card-body">
          <div id="clusterBars"></div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- SCHOOL USP -->
      <div class="sh"><div class="sh-title">Your Admissions USP</div><div class="sh-sub">Based on cohort personality + MI + ability data</div></div>
      <div class="usp-card">
        <div class="usp-eyebrow">School Intelligence · Navigator 360</div>
        <div class="usp-title">"A school where analytical, research-oriented students discover their direction"</div>
        <div class="usp-body">65% of your students show Investigative-Realistic personality — the profile that leads naturally into engineering, science, technology, and research. Your school is not just CBSE-aligned; it is cognitively profiled for STEM excellence. This is your admissions story.</div>
        <div class="usp-tags">
          <span class="usp-tag">I-R Dominant Cohort</span>
          <span class="usp-tag">STEM Pipeline</span>
          <span class="usp-tag">NEP Compliant</span>
          <span class="usp-tag">Psychometrically Validated</span>
          <span class="usp-tag">Data-backed Counselling</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- NEP COMPLIANCE -->
      <div class="sh"><div class="sh-title">NEP 2020 Holistic Progress Card</div><div class="sh-sub">Multi-dimensional assessment coverage</div></div>
      <div class="nep-grid">
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Cognitive Development</div><div class="nep-detail">RIASEC + Ability + MI scores document multi-dimensional cognitive profiling</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Social-Emotional</div><div class="nep-detail">Cultural compatibility + interpersonal MI document SEL</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Values & Ethics</div><div class="nep-detail">Section B values assessment provides documented values education evidence</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Career Guidance Gr 6–12</div><div class="nep-detail">Structured career assessment and pathway documentation in place</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Holistic Assessment</div><div class="nep-detail">6-pillar Navigator 360 satisfies multi-dimensional assessment mandate</div></div>
        <div class="nep-item warn"><div class="nep-icon">⚠️</div><div class="nep-name">Experiential Learning</div><div class="nep-detail">Field trips and project hours not yet tracked — 34% vs 50% target</div></div>
        <div class="nep-item warn"><div class="nep-icon">⚠️</div><div class="nep-name">Physical & Well-being</div><div class="nep-detail">Sports and fitness records exist but not integrated into HPC</div></div>
        <div class="nep-item fail"><div class="nep-icon">❌</div><div class="nep-name">Arts & Culture</div><div class="nep-detail">No structured arts/culture assessment currently in place</div></div>
      </div>
    </div>
  </div>

  <!-- SCALE OF PROBLEM — from Section E of survey -->
  <div class="sh"><div class="sh-title">Scale Calibration</div><div class="sh-sub">What your Discovery Survey estimated vs what Navigator 360 measured</div></div>
  <div class="g3">
    <div class="card">
      <div class="card-head"><span class="card-title">Career Clarity (Survey estimate)</span></div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--mu);margin-bottom:10px">Your survey answer: <strong>"50–75% of students are unclear about career direction"</strong></div>
        <div class="ibar"><span class="ib-lbl">Survey estimate</span><div class="ibg"><div class="ibf a" style="width:65%"></div></div><span class="ib-pct">~65%</span></div>
        <div class="ibar"><span class="ib-lbl">Navigator 360 measured</span><div class="ibg"><div class="ibf r" style="width:69%"></div></div><span class="ib-pct">69%</span></div>
        <div style="font-size:10px;color:var(--mu);margin-top:6px">Your estimate was accurate. The actual number of students without High CCI is <strong style="color:var(--rm)">69%</strong> — confirming the problem is as large as you suspected.</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Stream Change Requests</span></div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--mu);margin-bottom:10px">Your survey answer: <strong>"5–15 students request stream changes per year"</strong></div>
        <div class="ibar"><span class="ib-lbl">Predicted to request (from mismatch data)</span><div class="ibg"><div class="ibf r" style="width:72%"></div></div><span class="ib-pct">~35</span></div>
        <div style="font-size:10px;color:var(--mu);margin-top:6px">Navigator 360 predicts <strong style="color:var(--rm)">35 students</strong> are at high risk of stream change — more than double your estimate. Early intervention can prevent this.</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><span class="card-title">Parent Decision Influence</span></div>
      <div class="card-body">
        <div style="font-size:11px;color:var(--mu);margin-bottom:10px">Your survey answer: <strong>"Streams are chosen by marks + parent preference"</strong></div>
        <div class="ibar"><span class="ib-lbl">Marks-driven choices</span><div class="ibg"><div class="ibf t" style="width:58%"></div></div><span class="ib-pct">58%</span></div>
        <div class="ibar"><span class="ib-lbl">Aligned to aptitude</span><div class="ibg"><div class="ibf g" style="width:34%"></div></div><span class="ib-pct">34%</span></div>
        <div class="ibar"><span class="ib-lbl">Parent-overridden</span><div class="ibg"><div class="ibf r" style="width:42%"></div></div><span class="ib-pct">42%</span></div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════ TEACHER ══════════════════════════ -->
<div id="screen-teacher" class="screen">
  <div class="sh"><div class="sh-title">Class Intelligence Dashboard</div><div class="sh-sub">Select a class to view the learning profile and student alerts</div></div>

  <div class="class-select">
    <button class="cs-btn active" onclick="selectClass(this,'9A')">Grade 9A</button>
    <button class="cs-btn" onclick="selectClass(this,'9B')">Grade 9B</button>
    <button class="cs-btn" onclick="selectClass(this,'10A')">Grade 10A</button>
    <button class="cs-btn" onclick="selectClass(this,'10B')">Grade 10B</button>
    <button class="cs-btn" onclick="selectClass(this,'11S')">Grade 11 Science</button>
    <button class="cs-btn" onclick="selectClass(this,'11C')">Grade 11 Commerce</button>
  </div>

  <div class="g2">
    <div>
      <!-- Class MI profile -->
      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><span class="card-title">Class Learning Style Profile — Grade 9A (38 students)</span></div>
        <div class="card-body fill-anim">
          <div class="ibar"><span class="ib-lbl">Logical-Mathematical</span><div class="ibg"><div class="ibf t" style="width:72%"></div></div><span class="ib-pct" style="color:var(--tm)">72%</span></div>
          <div class="ibar"><span class="ib-lbl">Spatial-Visual</span><div class="ibg"><div class="ibf t" style="width:61%"></div></div><span class="ib-pct" style="color:var(--tm)">61%</span></div>
          <div class="ibar"><span class="ib-lbl">Interpersonal</span><div class="ibg"><div class="ibf b" style="width:48%"></div></div><span class="ib-pct" style="color:var(--bm)">48%</span></div>
          <div class="ibar"><span class="ib-lbl">Intrapersonal</span><div class="ibg"><div class="ibf b" style="width:44%"></div></div><span class="ib-pct" style="color:var(--bm)">44%</span></div>
          <div class="ibar"><span class="ib-lbl">Bodily-Kinesthetic</span><div class="ibg"><div class="ibf a" style="width:38%"></div></div><span class="ib-pct" style="color:var(--am)">38%</span></div>
          <div class="ibar"><span class="ib-lbl">Linguistic</span><div class="ibg"><div class="ibf a" style="width:32%"></div></div><span class="ib-pct" style="color:var(--am)">32%</span></div>
          <div style="background:var(--t05);border-radius:6px;padding:8px 10px;margin-top:8px;font-size:11px;color:var(--mg)">
            💡 <strong>Teaching insight:</strong> This class learns best through diagrams, logic puzzles, and structured analysis. Use visual-spatial explanations first. Avoid pure lecture format — engagement drops 40% without visual anchors.
          </div>
        </div>
      </div>

      <!-- Teaching strategies -->
      <div class="sh"><div class="sh-title">Recommended Classroom Strategies</div></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="strategy-card"><div class="sc-icon">🧮</div><div><div class="sc-title">Use structured problem-solving frameworks</div><div class="sc-body">72% Logical-Mathematical — give step-by-step breakdown before open exploration. This class needs the framework first, then the freedom.</div></div></div>
        <div class="strategy-card"><div class="sc-icon">📊</div><div><div class="sc-title">Visual anchors in every lesson</div><div class="sc-body">61% Spatial-Visual — start every topic with a diagram, map, or visual summary. Concept maps and infographic note-taking will improve retention by ~30%.</div></div></div>
        <div class="strategy-card"><div class="sc-icon">🤝</div><div><div class="sc-title">Pair intrapersonal learners with tasks, not teams</div><div class="sc-body">44% Intrapersonal — 17 students in this class prefer self-directed work. Give individual problem sets alongside group activities.</div></div></div>
        <div class="strategy-card"><div class="sc-icon">⚠️</div><div><div class="sc-title">Linguistic gap needs attention</div><div class="sc-body">Only 32% show Linguistic strength — this class will struggle with essay-heavy exams. Add vocabulary-building and written summary exercises weekly.</div></div></div>
      </div>
    </div>

    <div>
      <!-- Flagged students -->
      <div class="sh"><div class="sh-title">Students Needing Attention</div><span class="sh-pill sph-r">6 flagged</span></div>
      <div style="margin-bottom:12px">
        <div class="flag-row"><div class="flag-dot"></div><div><div class="flag-name">Aryan Mehta</div><div style="font-size:10px;color:var(--mu)">P-01: Undifferentiated personality · All RIASEC Low</div></div><span class="flag-badge">Urgent</span></div>
        <div class="flag-row"><div class="flag-dot"></div><div><div class="flag-name">Sneha Kapoor</div><div style="font-size:10px;color:var(--mu)">P-07: Aspiration–suitability mismatch · CCI Low</div></div><span class="flag-badge">Urgent</span></div>
        <div class="flag-row"><div class="flag-dot"></div><div><div class="flag-name">Kabir Singh</div><div style="font-size:10px;color:var(--mu)">P-09: High ability, low academic performance</div></div><span class="flag-badge">Investigate</span></div>
        <div class="flag-row"><div class="flag-dot" style="background:var(--am)"></div><div><div class="flag-name">Riya Sharma</div><div style="font-size:10px;color:var(--mu)">P-08: Values conflict with aspirations</div></div><span class="flag-badge" style="background:var(--a1);color:var(--a)">Monitor</span></div>
        <div class="flag-row"><div class="flag-dot" style="background:var(--am)"></div><div><div class="flag-name">Dev Patel</div><div style="font-size:10px;color:var(--mu)">P-03: Flat moderate profile · No dominant type</div></div><span class="flag-badge" style="background:var(--a1);color:var(--a)">Monitor</span></div>
        <div class="flag-row"><div class="flag-dot" style="background:var(--am)"></div><div><div class="flag-name">Ananya Joshi</div><div style="font-size:10px;color:var(--mu)">BIAS-01: Acquiescence detected in Section D</div></div><span class="flag-badge" style="background:var(--a1);color:var(--a)">Re-assess</span></div>
      </div>

      <!-- Student table -->
      <div class="sh"><div class="sh-title">Full Class Roster — Grade 9A</div></div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Student</th><th>Top Type</th><th>Learning Style</th><th>CCI</th><th>Flag</th><th>Action</th></tr></thead>
          <tbody>
            <tr><td><strong>Priya Singh</strong></td><td><span class="pill p-t">I-R</span></td><td>Logical-Math</td><td><span class="pill p-hi">High</span></td><td>—</td><td><span class="pill p-b" style="cursor:pointer">Report</span></td></tr>
            <tr class="flagged"><td><strong>Aryan Mehta</strong></td><td><span class="pill p-md">—</span></td><td>Undetermined</td><td><span class="pill p-lo">None</span></td><td>P-01</td><td><span class="pill p-lo" style="cursor:pointer">Urgent</span></td></tr>
            <tr><td><strong>Aarav Sharma</strong></td><td><span class="pill p-t">I-R-C</span></td><td>Logical-Math</td><td><span class="pill p-hi">High</span></td><td>—</td><td><span class="pill p-b" style="cursor:pointer">Report</span></td></tr>
            <tr class="flagged"><td><strong>Sneha Kapoor</strong></td><td><span class="pill p-t">S-A</span></td><td>Interpersonal</td><td><span class="pill p-lo">Low</span></td><td>P-07</td><td><span class="pill p-lo" style="cursor:pointer">Urgent</span></td></tr>
            <tr><td><strong>Rahul Verma</strong></td><td><span class="pill p-t">R-I</span></td><td>Spatial-Visual</td><td><span class="pill p-md">Moderate</span></td><td>—</td><td><span class="pill p-b" style="cursor:pointer">Report</span></td></tr>
            <tr class="flagged"><td><strong>Kabir Singh</strong></td><td><span class="pill p-t">I-E</span></td><td>Logical-Math</td><td><span class="pill p-md">Moderate</span></td><td>P-09</td><td><span class="pill p-md" style="cursor:pointer">Check</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════ COUNSELLOR ══════════════════════════ -->
<div id="screen-counsellor" class="screen">
  <div class="sh"><div class="sh-title">Student Guidance Centre</div><div class="sh-sub">Select a student to view their full psychometric profile</div></div>

  <div class="co-layout">
    <!-- Student list -->
    <div class="student-list">
      <div class="sl-head">
        <span class="sl-title">All Students</span>
        <span class="sl-count">487</span>
      </div>
      <div class="sl-search"><input type="text" placeholder="Search student name or grade…" oninput="filterStudents(this.value)"></div>
      <div class="sl-body" id="studentList"></div>
    </div>

    <!-- Student detail -->
    <div class="student-detail">
      <div style="display:flex;gap:10px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--bd);background:var(--off)">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--tm),var(--tl));display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:15px;color:#fff;flex-shrink:0">PS</div>
        <div>
          <div style="font-family:var(--serif);font-size:15px;color:var(--dk)">Priya Singh</div>
          <div style="font-size:11px;color:var(--mu)">Grade 10A &nbsp;·&nbsp; Navigator 360 &nbsp;·&nbsp; CCI: <strong style="color:var(--gm)">HIGH</strong></div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button style="padding:6px 12px;border:1px solid var(--bd);border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--sans);background:var(--wh)" onclick="openModal('sessionModal')">Add Note</button>
          <button style="padding:6px 12px;background:var(--tm);color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:var(--sans)">Download Report</button>
        </div>
      </div>

      <div class="sd-tabs">
        <div class="sdtab active" onclick="sdTab(this,'profile')">Profile</div>
        <div class="sdtab" onclick="sdTab(this,'scores')">Scores</div>
        <div class="sdtab" onclick="sdTab(this,'careers')">Career Matches</div>
        <div class="sdtab" onclick="sdTab(this,'notes')">Session Notes</div>
        <div class="sdtab" onclick="sdTab(this,'flags')">Flags</div>
      </div>

      <div class="sd-content">
        <div id="sd-profile">
          <div class="g2" style="margin-bottom:12px">
            <div>
              <div class="sec-lbl t">Personality (RIASEC)</div>
              <div class="riasec-row">
                <div class="rtype hi"><div class="rc">I</div><div class="rn">Investigative</div><div class="rs">89%</div></div>
                <div class="rtype hi"><div class="rc">R</div><div class="rn">Realistic</div><div class="rs">78%</div></div>
                <div class="rtype md"><div class="rc">C</div><div class="rn">Conventional</div><div class="rs">56%</div></div>
              </div>
              <div style="font-size:11px;color:var(--mu);margin-top:6px">Adjectives: Analytical · Curious · Precise · Independent · Practical</div>
            </div>
            <div>
              <div class="sec-lbl t">Top MI Domains</div>
              <div class="mi-bar"><span class="mi-lbl">Logical-Mathematical</span><div class="mi-bg"><div class="mi-fill" style="width:89%"></div></div><span class="mi-pct">89%</span></div>
              <div class="mi-bar"><span class="mi-lbl">Intrapersonal</span><div class="mi-bg"><div class="mi-fill" style="width:78%"></div></div><span class="mi-pct">78%</span></div>
              <div class="mi-bar"><span class="mi-lbl">Spatial-Visual</span><div class="mi-bg"><div class="mi-fill" style="width:78%"></div></div><span class="mi-pct">78%</span></div>
            </div>
          </div>
          <div class="g2">
            <div>
              <div class="sec-lbl a">Values Selected</div>
              <div class="val-chips">
                <span class="val-chip">Mental Activity</span>
                <span class="val-chip">High Achievement</span>
                <span class="val-chip">Autonomy</span>
                <span class="val-chip">Good Salary</span>
                <span class="val-chip">Creativity</span>
              </div>
            </div>
            <div>
              <div class="sec-lbl a">Aspirations</div>
              <div class="val-chips">
                <span class="asp-chip">Computer Science & IT</span>
                <span class="asp-chip">Engineering</span>
                <span class="asp-chip">Science & Maths</span>
                <span class="asp-chip">Life Sciences</span>
              </div>
            </div>
          </div>
          <div style="margin-top:12px;background:var(--t05);border-radius:8px;padding:10px 12px;border-left:3px solid var(--tm)">
            <div style="font-size:11px;font-weight:600;color:var(--mg);margin-bottom:3px">Counsellor quick note</div>
            <div style="font-size:11px;color:var(--mu)">Career Clarity HIGH. All aspirations align with I-type profile. Recommend: JEE preparation plan + Python project for CS pathway validation. Next session: discuss Life Sciences vs CS trade-off with parents.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══════════════════════════ STUDENT ══════════════════════════ -->
<div id="screen-student" class="screen">

  <div class="student-banner fu">
    <div class="stu-av">PS</div>
    <div style="flex:1">
      <div class="stu-name">Priya Singh</div>
      <div class="stu-meta">Grade 10A &nbsp;·&nbsp; Global Public School &nbsp;·&nbsp; Navigator 360 Subject Navigator &nbsp;·&nbsp; March 2025</div>
    </div>
    <div class="stu-cci">
      <div class="stu-cci-lbl">Career Clarity</div>
      <div class="stu-cci-val">HIGH ★</div>
    </div>
  </div>

  <!-- WHAT IS CCI -->
  <div style="background:var(--t05);border-radius:var(--rads);padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--mg);line-height:1.6;border-left:3px solid var(--tm)" class="fu2">
    <strong>Your Career Clarity Index:</strong> Your Career Clarity Index shows how closely your natural strengths and abilities align with the careers you aspire to — a higher score means you are naturally built for what you want to become, while a lower score means your strongest potential lies in a different direction worth exploring. <strong>Your CCI is HIGH</strong> — what you want and what you're built for are pointing in the same direction. ⬇ Explore your full profile below.
  </div>

  <div class="dual fu3">
    <!-- POTENTIAL -->
    <div class="panel">
      <div class="ph pot">
        <div class="ph-icon">⚡</div>
        <div><div class="ph-title">Your Potential</div><div class="ph-sub">What you are naturally built for</div></div>
        <div style="margin-left:auto;font-family:var(--serif);font-size:22px;color:var(--tl)">78<span style="font-size:12px;opacity:.5">/100</span></div>
      </div>

      <div class="sec">
        <div class="sec-lbl t">Career Personality — RIASEC</div>
        <div class="riasec-row">
          <div class="rtype hi"><div class="rc">I</div><div class="rn">Investigative</div><div class="rs">89%</div></div>
          <div class="rtype hi"><div class="rc">R</div><div class="rn">Realistic</div><div class="rs">78%</div></div>
          <div class="rtype md"><div class="rc">C</div><div class="rn">Conventional</div><div class="rs">56%</div></div>
          <div class="rtype lo"><div class="rc">A</div><div class="rn">Artistic</div><div class="rs">11%</div></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">
          <span class="pill p-t">Analytical</span><span class="pill p-t">Curious</span><span class="pill p-t">Precise</span><span class="pill p-t">Independent</span>
        </div>
      </div>

      <div class="sec">
        <div class="sec-lbl t">Learning Style — Gardner Model</div>
        <div class="mi-bar"><span class="mi-lbl">Logical-Mathematical</span><div class="mi-bg"><div class="mi-fill" style="width:89%"></div></div><span class="mi-pct">89%</span></div>
        <div class="mi-bar"><span class="mi-lbl">Intrapersonal</span><div class="mi-bg"><div class="mi-fill" style="width:78%"></div></div><span class="mi-pct">78%</span></div>
        <div class="mi-bar"><span class="mi-lbl">Spatial-Visual</span><div class="mi-bg"><div class="mi-fill" style="width:78%"></div></div><span class="mi-pct">78%</span></div>
        <div class="mi-bar" style="opacity:.45"><span class="mi-lbl">Musical</span><div class="mi-bg"><div class="mi-fill" style="width:22%;background:var(--rm)"></div></div><span class="mi-pct" style="color:var(--rm)">22%</span></div>
      </div>

      <div class="sec">
        <div class="sec-lbl t">Abilities — Top Strengths</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
          <span class="pill p-hi">Logical Reasoning</span><span class="pill p-hi">Computational</span><span class="pill p-hi">Technical</span><span class="pill p-hi">Decision Making</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          <span class="pill p-lo">⬆ Grow: Communication</span>
        </div>
      </div>

      <div class="sec">
        <div class="sec-lbl t">Academic Performance</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px">
          <div style="background:var(--t05);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--mu)">Maths</div><div style="font-family:var(--serif);font-size:18px;color:var(--mg)">88</div></div>
          <div style="background:var(--t05);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--mu)">Science</div><div style="font-family:var(--serif);font-size:18px;color:var(--mg)">84</div></div>
          <div style="background:var(--t05);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--mu)">CS</div><div style="font-family:var(--serif);font-size:18px;color:var(--mg)">92</div></div>
          <div style="background:var(--t05);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--mu)">English</div><div style="font-family:var(--serif);font-size:18px;color:var(--a)">71</div><div style="font-size:8px;color:var(--mu)">grow</div></div>
          <div style="background:var(--t05);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--mu)">Social</div><div style="font-family:var(--serif);font-size:18px;color:var(--mg)">76</div></div>
          <div style="background:var(--mg);border-radius:6px;padding:7px;text-align:center"><div style="font-size:9px;color:rgba(255,255,255,.5)">Overall</div><div style="font-family:var(--serif);font-size:18px;color:var(--tl)">82%</div></div>
        </div>
      </div>
    </div>

    <!-- PREFERENCE -->
    <div class="panel">
      <div class="ph pref">
        <div class="ph-icon">💫</div>
        <div><div class="ph-title">Your Preference</div><div class="ph-sub">What draws you and matters to you</div></div>
        <div style="margin-left:auto;font-family:var(--serif);font-size:22px;color:var(--al)">85<span style="font-size:12px;opacity:.5">/100</span></div>
      </div>

      <div class="sec">
        <div class="sec-lbl a">Core Values — What Matters to You</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <div style="display:flex;align-items:center;gap:8px"><div style="width:22px;height:22px;border-radius:6px;background:var(--a1);display:flex;align-items:center;justify-content:center;font-size:11px">🧠</div><div><div style="font-size:12px;font-weight:600">Mental Activity</div><div style="font-size:10px;color:var(--mu)">Thrive on complex thinking and analysis</div></div><span style="margin-left:auto;font-size:9px;font-weight:700;background:var(--a1);color:var(--a);padding:2px 6px;border-radius:10px">#1</span></div>
          <div style="display:flex;align-items:center;gap:8px"><div style="width:22px;height:22px;border-radius:6px;background:var(--a1);display:flex;align-items:center;justify-content:center;font-size:11px">🏆</div><div><div style="font-size:12px;font-weight:600">High Achievement</div><div style="font-size:10px;color:var(--mu)">Setting ambitious goals and reaching them</div></div><span style="margin-left:auto;font-size:9px;font-weight:700;background:var(--a1);color:var(--a);padding:2px 6px;border-radius:10px">#2</span></div>
          <div style="display:flex;align-items:center;gap:8px"><div style="width:22px;height:22px;border-radius:6px;background:var(--a1);display:flex;align-items:center;justify-content:center;font-size:11px">🔑</div><div><div style="font-size:12px;font-weight:600">Autonomy</div><div style="font-size:10px;color:var(--mu)">Making your own decisions</div></div><span style="margin-left:auto;font-size:9px;font-weight:700;background:var(--a1);color:var(--a);padding:2px 6px;border-radius:10px">#3</span></div>
          <div style="display:flex;align-items:center;gap:8px"><div style="width:22px;height:22px;border-radius:6px;background:var(--a1);display:flex;align-items:center;justify-content:center;font-size:11px">💰</div><div><div style="font-size:12px;font-weight:600">Good Salary</div><div style="font-size:10px;color:var(--mu)">Financial security and rewards</div></div><span style="margin-left:auto;font-size:9px;font-weight:700;background:var(--a1);color:var(--a);padding:2px 6px;border-radius:10px">#4</span></div>
          <div style="display:flex;align-items:center;gap:8px"><div style="width:22px;height:22px;border-radius:6px;background:var(--a1);display:flex;align-items:center;justify-content:center;font-size:11px">✨</div><div><div style="font-size:12px;font-weight:600">Creativity</div><div style="font-size:10px;color:var(--mu)">Building and expressing original ideas</div></div><span style="margin-left:auto;font-size:9px;font-weight:700;background:var(--a1);color:var(--a);padding:2px 6px;border-radius:10px">#5</span></div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-lbl a">Career Aspirations — Your Choices</div>
        <div class="val-chips">
          <span class="asp-chip">Computer Science & IT</span>
          <span class="asp-chip">Engineering</span>
          <span class="asp-chip">Science & Mathematics</span>
          <span class="asp-chip">Life Sciences</span>
        </div>
        <div style="font-size:11px;color:var(--mu);margin-top:8px;line-height:1.5">You are consistently drawn to roles where you <strong style="color:var(--a)">build, analyse, and discover</strong> — a powerful, coherent theme across all four choices.</div>
      </div>

      <div class="sec">
        <div class="sec-lbl a">Work Environment Fit</div>
        <div class="cc-chips">
          <span class="cc-on">🔬 Analytical</span>
          <span class="cc-on">🚀 Innovation</span>
          <span class="cc-on">🏆 Achievement</span>
          <span class="cc-off">🎨 Creative</span>
          <span class="cc-off">🤝 Collaborative</span>
          <span class="cc-off">🌱 Purpose</span>
        </div>
        <div style="font-size:11px;color:var(--mu);margin-top:7px">Best fit: <strong style="color:var(--a)">analytical, fast-moving, achievement-oriented</strong> environments — tech companies, research labs, startups.</div>
      </div>

      <div class="sec">
        <div class="sec-lbl a">Subjects of Interest</div>
        <div class="val-chips">
          <span class="asp-chip">Mathematics</span>
          <span class="asp-chip">Science</span>
        </div>
        <div style="font-size:11px;color:var(--a);margin-top:7px;font-weight:600">⚠ Only 2 subjects selected (min. 3). Tell your counsellor one more subject you enjoy.</div>
      </div>
    </div>
  </div>

  <!-- CONVERGENCE -->
  <div class="conv fu3">
    <div class="cv-side">
      <div class="cv-lbl">Potential Score</div>
      <div class="cv-score t">78<span style="font-size:16px;opacity:.5">/100</span></div>
      <div class="cv-sub">Personality · MI · Ability · Academic</div>
    </div>
    <div>
      <div class="cv-ring"><div class="cv-pct">83%</div><div class="cv-rl">Aligned</div></div>
      <div class="cv-msg">Potential meets Preference</div>
    </div>
    <div class="cv-side">
      <div class="cv-lbl">Preference Score</div>
      <div class="cv-score a">85<span style="font-size:16px;opacity:.5">/100</span></div>
      <div class="cv-sub">Values · Aspirations · Culture · Subjects</div>
    </div>
  </div>

  <!-- CAREER PATHWAYS -->
  <div class="sh fu3"><div class="sh-title">Your Top 3 Career Pathways</div><div class="sh-sub">These careers match your potential AND align with your values</div></div>
  <div class="career-grid fu3">

    <div class="cc r1">
      <div class="cc-head">
        <div class="cc-rank">🥇 Best Match</div>
        <div class="cc-name">Computer Science & AI</div>
        <div class="cc-tag">Build systems that power the next generation</div>
        <div class="cc-suit"><div class="cc-sn">9</div><div class="cc-sd">/9</div></div>
      </div>
      <div class="cc-body">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px">Matches your Potential:</div>
        <div class="cc-drivers"><span class="dr-p">I-type stanine 8</span><span class="dr-p">Logical-Math MI 89%</span><span class="dr-p">LR = 100%</span><span class="dr-p">Technical stanine 8</span></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px;margin-top:6px">Aligns with your Values:</div>
        <div class="cc-drivers"><span class="dr-v">Mental Activity ✓</span><span class="dr-v">Autonomy ✓</span><span class="dr-v">Good Salary ✓</span><span class="dr-v">Creativity ✓</span></div>
        <div class="cc-next"><strong>Next step:</strong> Start Codeforces/LeetCode. Focus JEE on Maths + Physics. Build one Python project this term.</div>
      </div>
    </div>

    <div class="cc r2">
      <div class="cc-head">
        <div class="cc-rank">🥈 Strong Match</div>
        <div class="cc-name">Science & Mathematics</div>
        <div class="cc-tag">Discover how the world fundamentally works</div>
        <div class="cc-suit"><div class="cc-sn">8</div><div class="cc-sd">/9</div></div>
      </div>
      <div class="cc-body">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px">Matches your Potential:</div>
        <div class="cc-drivers"><span class="dr-p">I-type dominant</span><span class="dr-p">Computational 89%</span><span class="dr-p">Intrapersonal MI 78%</span></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px;margin-top:6px">Aligns with your Values:</div>
        <div class="cc-drivers"><span class="dr-v">Mental Activity ✓</span><span class="dr-v">High Achievement ✓</span><span class="dr-v">Autonomy ✓</span></div>
        <div class="cc-next"><strong>Next step:</strong> Explore KVPY / NSO Olympiad eligibility. Ask Science teacher for research reading list.</div>
      </div>
    </div>

    <div class="cc r3">
      <div class="cc-head">
        <div class="cc-rank">🥉 Good Match</div>
        <div class="cc-name">Engineering & Technology</div>
        <div class="cc-tag">Design solutions to complex real-world problems</div>
        <div class="cc-suit"><div class="cc-sn">7</div><div class="cc-sd">/9</div></div>
      </div>
      <div class="cc-body">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px">Matches your Potential:</div>
        <div class="cc-drivers"><span class="dr-p">R-type stanine 7</span><span class="dr-p">Technical stanine 8</span><span class="dr-p">Spatial-Visual 78%</span></div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mu);margin-bottom:5px;margin-top:6px">Aligns with your Values:</div>
        <div class="cc-drivers"><span class="dr-v">Good Salary ✓</span><span class="dr-v">High Achievement ✓</span><span class="dr-v">Autonomy ✓</span></div>
        <div class="cc-next"><strong>Next step:</strong> Join robotics/electronics club. Visit NIT open day. Decide: software or hardware?</div>
      </div>
    </div>

  </div>
</div>

<!-- ══ MODALS ══ -->
<div class="modal-overlay" id="sessionModal">
  <div class="modal">
    <div class="modal-head"><span class="modal-title">Add Session Note — Priya Singh</span><button class="modal-close" onclick="closeModal('sessionModal')">×</button></div>
    <div class="modal-body">
      <div style="margin-bottom:10px;font-size:12px;color:var(--mu)">Session date: 13 May 2025 &nbsp;·&nbsp; Grade 10A &nbsp;·&nbsp; CCI: HIGH</div>
      <textarea rows="6" style="width:100%;border:1px solid var(--bd);border-radius:8px;padding:10px;font-size:12px;font-family:var(--sans);outline:none;resize:vertical" placeholder="Type your session notes here…"></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end">
        <button style="padding:8px 16px;border:1px solid var(--bd);border-radius:6px;font-size:12px;cursor:pointer;font-family:var(--sans)" onclick="closeModal('sessionModal')">Cancel</button>
        <button style="padding:8px 16px;background:var(--tm);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:var(--sans)">Save Note</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="cciModal">
  <div class="modal">
    <div class="modal-head"><span class="modal-title">Career Clarity Index — Grade-wise</span><button class="modal-close" onclick="closeModal('cciModal')">×</button></div>
    <div class="modal-body">
      <canvas id="cciChart" style="max-height:280px"></canvas>
    </div>
  </div>
</div>

<div class="modal-overlay" id="streamModal">
  <div class="modal">
    <div class="modal-head"><span class="modal-title">Stream Mismatch — Class Heatmap</span><button class="modal-close" onclick="closeModal('streamModal')">×</button></div>
    <div class="modal-body">
      <div style="font-size:12px;color:var(--mu);margin-bottom:12px">% of students whose RIASEC top type does NOT match their chosen stream</div>
      <div class="ibar"><span class="ib-lbl" style="min-width:160px">Grade 11 Science</span><div class="ibg"><div class="ibf r" style="width:38%"></div></div><span class="ib-pct" style="color:var(--rm)">38%</span></div>
      <div class="ibar"><span class="ib-lbl" style="min-width:160px">Grade 11 Commerce</span><div class="ibg"><div class="ibf a" style="width:29%"></div></div><span class="ib-pct" style="color:var(--am)">29%</span></div>
      <div class="ibar"><span class="ib-lbl" style="min-width:160px">Grade 11 Humanities</span><div class="ibg"><div class="ibf a" style="width:21%"></div></div><span class="ib-pct" style="color:var(--am)">21%</span></div>
      <div class="ibar"><span class="ib-lbl" style="min-width:160px">Grade 10A/B</span><div class="ibg"><div class="ibf t" style="width:12%"></div></div><span class="ib-pct" style="color:var(--tm)">12%</span></div>
      <div class="ibar"><span class="ib-lbl" style="min-width:160px">Grade 9A/B</span><div class="ibg"><div class="ibf t" style="width:8%"></div></div><span class="ib-pct" style="color:var(--tm)">8%</span></div>
      <div style="margin-top:12px;background:var(--r05);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--r)"><strong>Highest risk:</strong> Grade 11 Science — 38% of students have Social or Artistic dominant types but chose PCM. These are the students most likely to request stream changes.</div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="riskModal">
  <div class="modal">
    <div class="modal-head"><span class="modal-title">At-Risk Students — Active Flags</span><button class="modal-close" onclick="closeModal('riskModal')">×</button></div>
    <div class="modal-body">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--r05);border-radius:8px;padding:10px;text-align:center;border:1px solid var(--r1)"><div style="font-family:var(--serif);font-size:24px;color:var(--rm)">18</div><div style="font-size:10px;color:var(--mu)">P-01 Undifferentiated</div></div>
        <div style="background:var(--r05);border-radius:8px;padding:10px;text-align:center;border:1px solid var(--r1)"><div style="font-family:var(--serif);font-size:24px;color:var(--rm)">34</div><div style="font-size:10px;color:var(--mu)">P-07 Aspiration mismatch</div></div>
        <div style="background:var(--a05);border-radius:8px;padding:10px;text-align:center;border:1px solid var(--a1)"><div style="font-family:var(--serif);font-size:24px;color:var(--a)">11</div><div style="font-size:10px;color:var(--mu)">P-06 All abilities low</div></div>
      </div>
      <div style="font-size:12px;color:var(--mu)">63 unique students across all flags. 22 students carry multiple flags — these require priority counsellor sessions. See the Counsellor view for individual student profiles.</div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="nepModal">
  <div class="modal">
    <div class="modal-head"><span class="modal-title">NEP 2020 — Full Compliance Checklist</span><button class="modal-close" onclick="closeModal('nepModal')">×</button></div>
    <div class="modal-body">
      <div class="nep-grid">
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Cognitive Dev.</div><div class="nep-detail">RIASEC + Ability + MI</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Social-Emotional</div><div class="nep-detail">CC + Interpersonal MI</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Values & Ethics</div><div class="nep-detail">Section B values data</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Career Guidance</div><div class="nep-detail">Grades 6–12 pathway</div></div>
        <div class="nep-item pass"><div class="nep-icon">✅</div><div class="nep-name">Holistic Assessment</div><div class="nep-detail">6-pillar framework</div></div>
        <div class="nep-item warn"><div class="nep-icon">⚠️</div><div class="nep-name">Experiential</div><div class="nep-detail">34% vs 50% target</div></div>
        <div class="nep-item warn"><div class="nep-icon">⚠️</div><div class="nep-name">Physical</div><div class="nep-detail">Records not integrated</div></div>
        <div class="nep-item fail"><div class="nep-icon">❌</div><div class="nep-name">Arts & Culture</div><div class="nep-detail">No assessment system</div></div>
      </div>
    </div>
  </div>
</div>

`;

const CHART_JS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
const DASHBOARD_SCRIPT_SRC = "/career-navigator-school-navigator-dashboard.js";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

const SchoolNavigatorDashboardPage: FC = () => {
  useEffect(() => {
    const previousBodyBg = document.body.style.background;
    document.body.style.background = "#EEF5F1";

    const fontsLink = document.createElement("link");
    fontsLink.rel = "stylesheet";
    fontsLink.href = FONTS_HREF;
    fontsLink.dataset.schoolNavigatorDashboard = "fonts";
    document.head.appendChild(fontsLink);

    const chartScript = document.createElement("script");
    chartScript.src = CHART_JS_SRC;
    chartScript.async = false;
    chartScript.dataset.schoolNavigatorDashboard = "chart";

    let appScript: HTMLScriptElement | null = null;

    chartScript.onload = () => {
      appScript = document.createElement("script");
      appScript.src = DASHBOARD_SCRIPT_SRC;
      appScript.async = false;
      appScript.dataset.schoolNavigatorDashboard = "app";
      document.body.appendChild(appScript);
    };

    document.head.appendChild(chartScript);

    return () => {
      document.body.style.background = previousBodyBg;
      if (fontsLink.parentNode) fontsLink.parentNode.removeChild(fontsLink);
      if (chartScript.parentNode) chartScript.parentNode.removeChild(chartScript);
      if (appScript && appScript.parentNode) appScript.parentNode.removeChild(appScript);
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: NAVIGATOR_DASHBOARD_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: NAVIGATOR_DASHBOARD_BODY }} />
    </>
  );
};

export default SchoolNavigatorDashboardPage;
