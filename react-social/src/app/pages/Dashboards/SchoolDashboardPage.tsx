import { FC, useEffect } from "react";

const SCHOOL_DASHBOARD_CSS = String.raw`
:root{
  --p:#0C6B5A;--pd:#084A3E;--pl:#E0F2EE;
  --s:#36B37E;--acc:#F59E0B;--danger:#EF4444;
  --info:#3B82F6;--purple:#7C3AED;
  --bg:#F2F7F5;--card:#fff;--text:#1A2B28;
  --muted:#5C7A72;--border:#D1E5DF;
  --sh:0 2px 8px rgba(0,0,0,0.07);
  --r:10px;--rs:6px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);font-size:14px;min-height:100vh}

/* ── TOP BAR ── */
.topbar{background:var(--pd);color:#fff;padding:0 20px;display:flex;align-items:center;gap:16px;height:54px;position:sticky;top:0;z-index:100}
.brand{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;white-space:nowrap}
.brand-dot{width:8px;height:8px;background:var(--s);border-radius:50%}
.role-nav{display:flex;gap:2px;flex:1}
.rbtn{padding:7px 16px;background:transparent;color:rgba(255,255,255,0.6);border:none;cursor:pointer;font-size:12px;font-weight:500;border-radius:var(--rs);transition:all .2s;white-space:nowrap}
.rbtn.active{background:rgba(255,255,255,0.16);color:#fff}
.rbtn:hover:not(.active){background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85)}
.school-badge{font-size:11px;background:rgba(255,255,255,0.12);padding:3px 10px;border-radius:20px;white-space:nowrap;color:rgba(255,255,255,0.75)}
.notif-bell{position:relative;cursor:pointer;font-size:16px;color:rgba(255,255,255,0.75);padding:4px}
.notif-count{position:absolute;top:-2px;right:-2px;background:var(--danger);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:8px;min-width:14px;text-align:center}

/* ── DASH PANELS ── */
.dash{display:none;padding:18px 20px 40px;max-width:1200px;margin:0 auto}
.dash.active{display:block}

/* ── SECTION LABELS ── */
.section-header{margin-bottom:14px}
.section-title{font-size:17px;font-weight:600;color:var(--pd)}
.section-sub{font-size:11px;color:var(--muted);margin-top:2px}
.section-divider{display:flex;align-items:center;gap:10px;margin:18px 0 10px}
.section-divider-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;padding:3px 10px;border-radius:12px}
.school-potential-label{background:#E0F2EE;color:var(--pd)}
.external-mapping-label{background:#FEF3C7;color:#92400E}
.section-divider-line{flex:1;height:1px;background:var(--border)}

/* ── NEP SECTION ── */
.nep-section{margin-bottom:18px}
.nep-section-header{background:var(--pd);color:#fff;border-radius:var(--r) var(--r) 0 0;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.nep-section-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px}
.nep-score-pill{background:rgba(255,255,255,0.18);padding:3px 12px;border-radius:12px;font-size:12px;font-weight:700}
.nep-score-pill.warn{background:rgba(245,158,11,0.4);color:#FDE68A}
.nep-section-legend{display:flex;gap:14px;font-size:10px}
.nep-section-legend span{color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:4px}
.nep-cards-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r) var(--r);overflow:hidden;box-shadow:var(--sh)}
.nep-card{background:var(--card);padding:14px 16px;border-right:1px solid var(--border);position:relative}
.nep-card:last-child{border-right:none}
.nep-card.warn-card{background:#FFFBEB}
.nep-card.warn-card:hover{background:#FEF3C7}
.nep-card:hover{background:#FAFCFB}
.nep-card-status{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.nep-status-ok{width:20px;height:20px;border-radius:50%;background:#D1FAE5;display:flex;align-items:center;justify-content:center;font-size:10px;color:#065F46;flex-shrink:0;font-weight:700}
.nep-status-warn{width:20px;height:20px;border-radius:50%;background:#FEF3C7;display:flex;align-items:center;justify-content:center;font-size:10px;color:#92400E;flex-shrink:0;font-weight:700}
.nep-card-label{font-size:11px;font-weight:700;color:var(--text);flex:1}
.nep-card-ref{font-size:9px;background:#E0F2EE;color:var(--pd);padding:1px 6px;border-radius:8px;white-space:nowrap}
.nep-card-ref.warn-ref{background:#FDE68A;color:#92400E}
.nep-card-body{font-size:11px;color:var(--muted);line-height:1.55;margin-bottom:8px}
.nep-card-guideline{background:#F0FDF4;border-left:3px solid var(--s);padding:7px 10px;border-radius:0 var(--rs) var(--rs) 0;font-size:11px;color:var(--pd);line-height:1.5;margin-bottom:6px}
.nep-card-guideline.warn-gl{background:#FFFBEB;border-left-color:var(--acc);color:#92400E}
.nep-card-guideline.danger-gl{background:#FEF2F2;border-left-color:var(--danger);color:#991B1B}
.nep-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.nep-action-tag{font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600}
/* compact banner retained for other uses */
.nep-banner{background:var(--pd);color:#fff;border-radius:var(--r);padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.nep-item-inline{display:flex;align-items:center;gap:6px;font-size:11px}
.nep-ok{color:#6EE7B7}
.nep-warn{color:#FCD34D}
.nep-score{background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600}
.nep-legend{margin-left:auto;display:flex;gap:10px;font-size:10px}
.nep-legend-item{display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.7)}

/* ── CARDS ── */
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh)}
.card-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:10px}

/* ── KPI CARDS ── */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh);cursor:pointer;transition:all .18s;position:relative;overflow:hidden}
.kpi-card:hover{border-color:var(--p);box-shadow:0 4px 16px rgba(12,107,90,0.15);transform:translateY(-1px)}
.kpi-card::after{content:'↗';position:absolute;bottom:8px;right:10px;font-size:10px;color:var(--muted);opacity:0;transition:opacity .2s}
.kpi-card:hover::after{opacity:1}
.kpi-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}
.kpi-value{font-size:26px;font-weight:700;color:var(--pd);margin:5px 0 2px;line-height:1}
.kpi-value.red{color:var(--danger)}
.kpi-delta{font-size:11px;color:var(--muted)}
.kpi-delta.up{color:var(--s)}
.kpi-delta.warn{color:var(--acc)}
.kpi-delta.danger{color:var(--danger)}
.kpi-bar{height:3px;border-radius:2px;margin-top:10px}

/* ── GRID ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
.g12{display:grid;grid-template-columns:1fr 2fr;gap:14px;margin-bottom:14px}
.g21{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px}
.mb14{margin-bottom:14px}

/* ── CHART WRAP ── */
.cw canvas{max-height:200px}
.cw.tall canvas{max-height:260px}
.cw.md canvas{max-height:230px}

/* ── TABLE ── */
.dtable{width:100%;border-collapse:collapse;font-size:12px}
.dtable th{text-align:left;padding:7px 9px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);border-bottom:1px solid var(--border);background:#FAFCFB}
.dtable td{padding:8px 9px;border-bottom:1px solid var(--border);vertical-align:middle}
.dtable tr:last-child td{border-bottom:none}
.dtable tr:hover td{background:#F8FDFB}
.tscroll{overflow-x:auto}

/* ── BADGES ── */
.badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:600}
.bh{background:#D1FAE5;color:#065F46}
.bm{background:#FEF3C7;color:#92400E}
.bl{background:#FEE2E2;color:#991B1B}
.bn{background:#F3F4F6;color:#6B7280}
.bb{background:#DBEAFE;color:#1E40AF}
.bp{background:#EDE9FE;color:#5B21B6}
.bt{background:var(--pl);color:var(--pd)}
.br{background:#FFE4E6;color:#9F1239}

/* ── DOTS ── */
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
.dr{background:var(--danger)}.dy{background:var(--acc)}.dg{background:var(--s)}

/* ── PROGRESS ── */
.pb{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.pf{height:100%;border-radius:3px}

/* ── INSIGHT BOX ── */
.insight{background:var(--pl);border:1px solid rgba(12,107,90,0.2);border-radius:var(--rs);padding:9px 11px;font-size:11px;color:var(--pd);display:flex;gap:8px;margin-top:10px}

/* ── LEGEND ── */
.legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.legend-item{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted)}
.ld{width:9px;height:9px;border-radius:50%}

/* ── MODAL ── */
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:500;align-items:center;justify-content:center;padding:20px}
.modal-bg.open{display:flex}
.modal{background:var(--card);border-radius:var(--r);padding:0;max-width:820px;width:100%;max-height:85vh;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column}
.modal-head{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:#FAFCFB}
.modal-head h3{font-size:15px;font-weight:600;color:var(--pd)}
.modal-body{padding:18px 20px;overflow-y:auto;flex:1}
.modal-close{background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 10px;cursor:pointer;font-size:12px;color:var(--muted)}
.modal-close:hover{background:var(--border)}

/* ── TOOLTIP ── */
.tt-wrap{position:relative;display:inline-block;cursor:pointer}
.tt-box{display:none;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--pd);color:#fff;border-radius:var(--rs);padding:10px 13px;font-size:11px;z-index:200;width:240px;line-height:1.5;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.2)}
.tt-box::before{content:'';position:absolute;top:-5px;left:50%;transform:translateX(-50%);border:5px solid transparent;border-bottom-color:var(--pd);border-top:none}
.tt-wrap:hover .tt-box{display:block}

/* ── TEACHER ── */
.filter-row{display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap}
.fsel{padding:6px 10px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;background:var(--card);color:var(--text);cursor:pointer}
.flabel{font-size:11px;color:var(--muted)}
.btn{padding:6px 12px;border-radius:var(--rs);border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:12px;font-weight:500;transition:all .15s}
.btn:hover{background:var(--pl);border-color:var(--p);color:var(--pd)}
.btn-primary{background:var(--p);color:#fff;border-color:var(--p)}
.btn-primary:hover{background:var(--pd);color:#fff}
.btn-sm{padding:4px 9px;font-size:11px}
.btn-danger{background:#FEE2E2;color:#991B1B;border-color:#FECACA}
.btn-danger:hover{background:#FCA5A5;color:#7F1D1D}

/* ── SECTION COMPARISON ── */
.comp-bar-wrap{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.comp-bar-label{font-size:11px;width:50px;color:var(--text);flex-shrink:0}
.comp-bar-inner{flex:1}
.comp-bar-val{font-size:11px;font-weight:600;color:var(--pd);width:32px;text-align:right}
.my-section{font-weight:700;color:var(--pd)}

/* ── NOTE BOX ── */
.note-area{width:100%;min-height:72px;padding:9px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;resize:vertical;font-family:inherit;color:var(--text);outline:none}
.note-area:focus{border-color:var(--p)}
.note-item{background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:8px 10px;font-size:12px;margin-bottom:6px}
.note-meta{font-size:10px;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:3px}
.note-reply{background:#EEF2FF;border:1px solid #C7D2FE;border-radius:var(--rs);padding:7px 10px;font-size:11px;margin-top:5px;color:#3730A3}
.note-reply-meta{font-size:10px;color:#6366F1;margin-bottom:2px}

/* ── COUNSELLOR ── */
.cl-layout{display:grid;grid-template-columns:280px 1fr;gap:14px}
.slist-panel{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--sh);overflow:hidden;display:flex;flex-direction:column}
.slist-head{padding:10px 12px;border-bottom:1px solid var(--border);background:#FAFCFB;flex-shrink:0}
.ssearch{width:100%;padding:6px 9px;border:1px solid var(--border);border-radius:var(--rs);font-size:12px;background:#fff;color:var(--text);outline:none}
.ssearch:focus{border-color:var(--p)}
.slist{overflow-y:auto;flex:1;max-height:480px}
.sitem{padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;transition:background .15s}
.sitem:hover{background:var(--pl)}
.sitem.active{background:var(--pl);border-left:3px solid var(--p)}
.sitem-name{font-size:12px;font-weight:500}
.sitem-cls{font-size:10px;color:var(--muted)}
.cci-tabs{display:flex;gap:3px;margin-top:7px;flex-wrap:wrap}
.ctab{padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s}
.ctab-all{background:var(--p);color:#fff}
.ctab-high{background:#D1FAE5;color:#065F46}
.ctab-mod{background:#FEF3C7;color:#92400E}
.ctab-low{background:#FEE2E2;color:#991B1B}
.ctab-none{background:#F3F4F6;color:#6B7280}
.sdetail{display:flex;flex-direction:column;gap:12px}

/* ── MSG/NOTIF ── */
.notif-panel{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh);margin-bottom:14px}
.notif-panel-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.msg-item{background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px 12px;margin-bottom:8px}
.msg-from{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--p);margin-bottom:3px}
.msg-from.from-principal{color:#7C3AED}
.msg-from.from-teacher{color:#0891B2}
.msg-body{font-size:12px;color:var(--text);line-height:1.5}
.msg-time{font-size:10px;color:var(--muted)}
.reply-to{font-style:italic;color:var(--muted);font-size:11px;margin-top:5px;padding-top:5px;border-top:1px solid var(--border)}
.unread-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--danger);margin-right:4px;vertical-align:middle}

/* ── STUDENT DASH ── */
.prof-header{background:linear-gradient(135deg,var(--pd),var(--p));border-radius:var(--r);padding:16px;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:14px}
.avatar{width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0}
.prof-name{font-size:17px;font-weight:600}
.prof-info{font-size:11px;opacity:.8;margin-top:2px}
.stags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
.stag{background:rgba(255,255,255,0.18);padding:2px 7px;border-radius:10px;font-size:10px}

/* ── PILLARS ── */
.prow{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.plabel{width:120px;font-size:11px;color:var(--muted);flex-shrink:0}
.pval{width:36px;text-align:right;font-size:11px;font-weight:600;color:var(--pd)}

/* ── QR ── */
.qr-box{background:var(--pd);border-radius:var(--rs);padding:14px;text-align:center;color:#fff}
.qr-code{width:90px;height:90px;background:#fff;border-radius:4px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.qr-code canvas{width:90px!important;height:90px!important}

/* ── STRATEGY ── */
.strat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.strat-card{background:var(--pl);border:1px solid rgba(12,107,90,0.2);border-radius:var(--rs);padding:10px}
.strat-icon{font-size:16px;margin-bottom:3px}
.strat-title{font-size:11px;font-weight:600;color:var(--pd)}
.strat-desc{font-size:10px;color:var(--muted);margin-top:2px;line-height:1.4}

/* ── GRADE BADGE TABLE ── */
.grade-comp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.grade-comp-card{background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center}
.grade-comp-grade{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.grade-comp-val{font-size:20px;font-weight:700;color:var(--pd)}
.grade-comp-bar{margin-top:5px}

/* ── NEP BUTTON BAR ── */
.nep-btn-bar{background:var(--pd);border-radius:var(--r);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.nep-btn-bar-title{font-size:12px;font-weight:700;color:#fff;white-space:nowrap;display:flex;align-items:center;gap:8px}
.nep-btn{padding:6px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:none;transition:all .18s;display:flex;align-items:center;gap:5px}
.nep-btn-ok{background:rgba(110,231,183,0.2);color:#6EE7B7;border:1px solid rgba(110,231,183,0.35)}
.nep-btn-ok:hover{background:rgba(110,231,183,0.3);color:#fff}
.nep-btn-warn{background:rgba(252,211,77,0.2);color:#FCD34D;border:1px solid rgba(252,211,77,0.35)}
.nep-btn-warn:hover{background:rgba(252,211,77,0.3);color:#fff}
.nep-overall{background:rgba(255,255,255,0.12);padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700;color:#fff;margin-left:auto}

/* ── CALENDAR ── */
.cal-wrap{user-select:none}
.cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-nav{background:none;border:1px solid var(--border);border-radius:var(--rs);padding:4px 9px;cursor:pointer;font-size:12px;color:var(--text)}
.cal-nav:hover{background:var(--pl)}
.cal-month{font-size:13px;font-weight:600;color:var(--pd)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-day-label{text-align:center;font-size:10px;font-weight:700;color:var(--muted);padding:4px 0}
.cal-day{text-align:center;padding:6px 0;font-size:12px;border-radius:var(--rs);cursor:pointer;border:1px solid transparent;transition:all .15s;position:relative}
.cal-day:hover{background:var(--pl);border-color:var(--p)}
.cal-day.today{background:var(--p);color:#fff;font-weight:700}
.cal-day.has-appt{background:#EDE9FE;color:var(--purple);font-weight:600}
.cal-day.has-appt::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--purple)}
.cal-day.empty{cursor:default}
.appt-list{margin-top:12px;max-height:160px;overflow-y:auto}
.appt-item{background:#F8FDFB;border:1px solid var(--border);border-left:3px solid var(--p);border-radius:var(--rs);padding:7px 9px;margin-bottom:6px;font-size:11px}
.appt-time{font-weight:600;color:var(--pd)}
.appt-student{color:var(--text);margin-top:1px}
.appt-type{font-size:10px;color:var(--muted)}

/* ── DOWNLOAD BUTTON ── */
.dl-btn{display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--pd);color:#fff;border:none;border-radius:var(--rs);cursor:pointer;font-size:12px;font-weight:600;transition:all .18s}
.dl-btn:hover{background:var(--p)}

/* ── REPORT CARD SUMMARY ── */
.rc-modal-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#EDE9FE;color:var(--purple);border:1px solid #C4B5FD;border-radius:var(--rs);font-size:10px;font-weight:600;cursor:pointer;transition:all .15s}
.rc-modal-btn:hover{background:#DDD6FE}

/* ── BOOK APPT CARD ── */
.appt-book-card{background:var(--pd);border-radius:var(--rs);padding:12px 14px;color:#fff;margin-top:10px}
.appt-book-title{font-size:12px;font-weight:700;margin-bottom:6px}
.appt-book-body{font-size:11px;opacity:.85;margin-bottom:10px;line-height:1.5}
`;

const SCHOOL_DASHBOARD_BODY = String.raw`

<!-- TOP BAR -->
<div class="topbar">
  <div class="brand"><div class="brand-dot"></div>Career Navigator 360</div>
  <div class="role-nav">
    <button class="rbtn active" onclick="switchRole('principal',this)">🏫 Principal</button>
    <button class="rbtn" onclick="switchRole('teacher',this)">📖 Teacher</button>
    <button class="rbtn" onclick="switchRole('counsellor',this)">🧠 Counsellor</button>
    <button class="rbtn" onclick="switchRole('student',this)">🎓 Student</button>
  </div>
  <div class="school-badge">Sunrise Public School, Nashik</div>
  <div class="notif-bell" onclick="switchRole('counsellor',document.querySelectorAll('.rbtn')[2])">
    🔔<span class="notif-count" id="notifCount">3</span>
  </div>
</div>

<!-- ════════════════ PRINCIPAL ════════════════ -->
<div id="dash-principal" class="dash active">
  <div class="section-header">
    <div class="section-title">School Intelligence Overview</div>
    <div class="section-sub">Navigator 360 · AY 2024-25 · Grades 6–12 · NEP 2020 &amp; CBSE Career Guidance Framework</div>
  </div>

  <!-- NEP & CBSE BUTTON BAR -->
  <div class="nep-btn-bar">
    <div class="nep-btn-bar-title">
      📋 NEP 2020 &amp; CBSE Compliance
    </div>
    <button class="nep-btn nep-btn-ok" onclick="openModal('nep1')">✔ Career Guidance Gr 6–12</button>
    <button class="nep-btn nep-btn-ok" onclick="openModal('nep2')">✔ Holistic Assessment</button>
    <button class="nep-btn nep-btn-ok" onclick="openModal('nep3')">✔ Multiple Intelligences</button>
    <button class="nep-btn nep-btn-ok" onclick="openModal('nep4')">✔ CBSE Guidance Cell</button>
    <button class="nep-btn nep-btn-warn" onclick="openModal('nep5')">! Vocational Integration (34%)</button>
    <button class="nep-btn nep-btn-warn" onclick="openModal('nep6')">! Experiential Field Trips</button>
    <div class="nep-overall">6 / 8 Compliant</div>
  </div>

  <!-- NEP MODALS -->
  <div class="modal-bg" id="modal-nep1">
    <div class="modal"><div class="modal-head"><h3>✔ Career Guidance Gr 6–12 — NEP §15.6</h3><button class="modal-close" onclick="closeModal('nep1')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px"><span>📌</span><span>NEP 2020 mandates age-appropriate career counselling from Grade 6 onward as a <strong>continuous journey</strong>, not a one-time test. The policy explicitly moves away from stream-selection pressure in Grade 10–11 toward gradual, informed career awareness built year by year.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>Career exposure and exploration activities for Grades 6, 7, and 8 — age-appropriate, interest-based</li>
        <li>Subject-awareness counselling in Grades 9–10 to inform stream selection</li>
        <li>Professional career guidance and college readiness support in Grades 11–12</li>
        <li>Counsellor-to-student ratio: recommended 1:150 by NEP (CBSE guideline)</li>
        <li>Documentation of each student's career journey — updated annually</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:var(--s);margin-bottom:8px">How your school complies</div>
      <div style="background:#F0FDF4;border-left:3px solid var(--s);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:var(--text)">
        Navigator 360 is active across all three stages: <strong>Insight Navigator (Gr 6–8)</strong> builds self-awareness through interests, values, and learning styles; <strong>Subject Navigator (Gr 9–10)</strong> links learning styles to subject selection; <strong>Career Navigator (Gr 11–12)</strong> provides suitability scoring and college readiness guidance. All 487 students are covered. Digital records are maintained per student in the Counsellor dashboard.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <span class="badge bh">487 students covered</span>
        <span class="badge bb">3-stage pipeline active</span>
        <span class="badge bt">Counsellor dashboard live</span>
        <span class="badge bp">Annual records maintained</span>
      </div>
    </div></div>
  </div>

  <div class="modal-bg" id="modal-nep2">
    <div class="modal"><div class="modal-head"><h3>✔ Holistic Progress Assessment — NEP §4.37 &amp; CBSE HP Card</h3><button class="modal-close" onclick="closeModal('nep2')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px"><span>📌</span><span>NEP 2020 §4.37 requires that assessment move beyond marks and grades to capture the whole child — including character, competencies, creativity, and collaboration. CBSE's Holistic Progress Card (introduced 2023) operationalises this for Classes 3–8 and is being extended through Class 12.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>Assessment across cognitive, emotional, social, and physical domains</li>
        <li>No ranking or comparison between students — individual growth tracking</li>
        <li>Student self-assessment and peer feedback components</li>
        <li>Portfolio-based evidence in addition to written examinations</li>
        <li>360-degree feedback involving teachers, parents, and the student</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:var(--s);margin-bottom:8px">How your school complies</div>
      <div style="background:#F0FDF4;border-left:3px solid var(--s);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:var(--text)">
        Navigator 360's <strong>6-pillar framework</strong> directly maps to the CBSE Holistic Progress Card parameters. The six pillars — Career Personality, Learning Styles (MI), Ability, Values, Subjects of Interest, and Aspirations — capture cognitive (Ability, MI), character (Values), and aspirational (Aspirations, Personality) dimensions. Reports are student-specific, non-comparative, and updated each assessment cycle. Teacher dashboards provide individual growth tracking per student.
      </div>
      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:700;color:var(--pd);margin-bottom:5px">Navigator 360 Pillar → HP Card Mapping</div>
          <div style="font-size:11px;line-height:1.7;color:var(--text)">Career Personality → Social-Emotional competency<br>Learning Styles → Cognitive competency<br>Ability → Academic performance<br>Values → Character &amp; ethics<br>Subjects of Interest → Co-curricular participation<br>Aspirations → Self-awareness &amp; goal-setting</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <span class="badge bh" style="font-size:11px;padding:5px 10px">6 pillars → CBSE HP Card aligned</span>
          <span class="badge bb" style="font-size:11px;padding:5px 10px">Non-comparative, growth-based</span>
          <span class="badge bt" style="font-size:11px;padding:5px 10px">360° data: student + teacher view</span>
          <span class="badge bp" style="font-size:11px;padding:5px 10px">Individual report per student</span>
        </div>
      </div>
    </div></div>
  </div>

  <div class="modal-bg" id="modal-nep3">
    <div class="modal"><div class="modal-head"><h3>✔ Multiple Intelligences — NEP §4.6 &amp; Howard Gardner Model</h3><button class="modal-close" onclick="closeModal('nep3')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px"><span>📌</span><span>NEP 2020 §4.6 explicitly states that the traditional focus on linguistic and logical intelligences must give way to recognition of diverse forms of intelligence. Schools are directed to identify and nurture each child's unique intelligence profile across arts, sports, languages, music, and other domains.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>Recognition that every child has a unique combination of strengths — not just academic ability</li>
        <li>Classroom strategies tailored to diverse learning styles, not one-size-fits-all teaching</li>
        <li>Extracurricular integration for students strong in artistic, kinesthetic, musical, and naturalistic domains</li>
        <li>Teacher training in identifying and supporting non-traditional intelligences</li>
        <li>Parent communication about their child's specific intelligence profile</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:var(--s);margin-bottom:8px">How your school complies &amp; what the data shows</div>
      <div style="background:#F0FDF4;border-left:3px solid var(--s);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:var(--text);margin-bottom:10px">
        All 8 Gardner intelligences are assessed per student. The Teacher Dashboard auto-generates class-level learning style profiles and recommends specific teaching strategies. Notable finding: <strong>Bodily-Kinesthetic intelligence is the highest in Grades 6–8 (72%)</strong>, yet receives the least classroom attention — prime area for growth. Linguistic intelligence is dropping across grades (71% → 58%) indicating a curriculum gap.
      </div>
      <div style="background:#FEF3C7;border-left:3px solid var(--acc);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:#92400E">
        <strong>Action recommended:</strong> Schedule MI-based parent communication sessions this term. Share each child's top 3 intelligence areas with parents to align home support. Teacher training on differentiated instruction needed for Musical and Linguistic domains — both declining across grades.
      </div>
    </div></div>
  </div>

  <div class="modal-bg" id="modal-nep4">
    <div class="modal"><div class="modal-head"><h3>✔ CBSE Career Guidance Cell — CBSE Circular 2023</h3><button class="modal-close" onclick="closeModal('nep4')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px"><span>📌</span><span>CBSE's 2023 circular mandates every affiliated school to establish a functional Career Guidance Cell with a designated trained counsellor, student-accessible resources, documented session records, and integration with the school's academic calendar.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>Designated school counsellor trained in career guidance (CBSE-approved certification)</li>
        <li>Minimum 2 career guidance sessions per student per year — documented</li>
        <li>Career resource library accessible to students (physical or digital)</li>
        <li>Annual Career Fair or Career Day event</li>
        <li>Collaboration with external colleges, universities, and industry for student exposure</li>
        <li>Individual student counselling records maintained for audit</li>
        <li>Parent involvement in at least 1 career session per year</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:var(--s);margin-bottom:8px">How your school complies</div>
      <div style="background:#F0FDF4;border-left:3px solid var(--s);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:var(--text);margin-bottom:10px">
        The Counsellor Dashboard provides individual student profiles, session note tracking, cross-role communication (teacher → counsellor → principal), and searchable student records filterable by grade, section, personality type, and CCI status. All session notes are date-stamped and per-student. Red-flag alerts from teachers arrive directly in the counsellor's message inbox.
      </div>
      <div style="background:#FEF3C7;border-left:3px solid var(--acc);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:#92400E">
        <strong>Recommended next steps:</strong> (1) Schedule the Annual Career Fair — no date set yet. (2) Document parent involvement sessions in the counsellor records. (3) Verify counsellor's CBSE certification is current. (4) Ensure career resource library (physical or Career-9 digital) is communicated to all students.
      </div>
    </div></div>
  </div>

  <div class="modal-bg" id="modal-nep5">
    <div class="modal"><div class="modal-head"><h3>⚠ Vocational Integration — NEP §16 &amp; CBSE Skill Education Framework</h3><button class="modal-close" onclick="closeModal('nep5')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px;background:#FEF2F2;border-color:#FECACA"><span style="color:#991B1B">⚠</span><span style="color:#991B1B"><strong>Current status: 34% of students exposed to vocational fields. NEP target: 50% by 2025, 100% by 2030.</strong> This is the most significant compliance gap in your school's NEP implementation.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>At least 50% of all students must have exposure to at least one vocational skill by 2025</li>
        <li>Vocational education must be treated as <em>equal</em> to academic education — not a fallback option</li>
        <li>CBSE Skill subjects available from Class 6: IT, Agriculture, Home Science, Retail, Healthcare, Beauty &amp; Wellness, Tourism, BFSI</li>
        <li>10-day vocational internship for students in Classes 6–8 (bagless day format)</li>
        <li>NSQF-aligned certification for students completing skill modules in Grades 9–12</li>
        <li>Integration into timetable — not only as an add-on but as a regular subject option</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:#92400E;margin-bottom:10px">What your Navigator data reveals — and what to do</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:6px">📊 Data-Driven Student Targets</div>
          <ul style="font-size:11px;line-height:1.75;color:var(--text);padding-left:14px">
            <li><strong>~58 students</strong> with Realistic personality + Kinesthetic learning style are ideal vocational candidates but are not being counselled toward those paths</li>
            <li><strong>34% of school</strong> (Realistic personality type) maps directly to trades, manufacturing, construction, sports science, and culinary arts</li>
            <li>Students with low Computational ability are being directed toward academic tracks despite having strong Manual + Technical abilities — a systematic mismatch</li>
            <li>Naturalistic intelligence students (70% in Gr 6–8) have high Agriculture / Environmental suitability, yet fewer than 10% aspire to those fields</li>
          </ul>
        </div>
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:6px">🗓 Action Plan — by Timeline</div>
          <div style="font-size:11px;font-weight:600;color:var(--pd);margin-bottom:3px">This week:</div>
          <ul style="font-size:11px;line-height:1.65;color:var(--text);padding-left:12px;margin-bottom:6px">
            <li>Survey teachers: which vocational skill can each integrate into their subject?</li>
            <li>Brief counsellor to identify 58 Realistic/Kinesthetic students for targeted sessions</li>
          </ul>
          <div style="font-size:11px;font-weight:600;color:var(--pd);margin-bottom:3px">This term:</div>
          <ul style="font-size:11px;line-height:1.65;color:var(--text);padding-left:12px;margin-bottom:6px">
            <li>Contact local ITI / polytechnic for joint open day or guest speaker series</li>
            <li>Review timetable: identify SUPW periods for vocational exploration activities</li>
            <li>Add CBSE Skill subject as 6th subject option in Grade 9–12</li>
          </ul>
          <div style="font-size:11px;font-weight:600;color:var(--pd);margin-bottom:3px">This year:</div>
          <ul style="font-size:11px;line-height:1.65;color:var(--text);padding-left:12px">
            <li>Run 10-day vocational immersion camp in vacation (NSQF Level 1–2 certification)</li>
            <li>Feature vocational professionals in the monthly career talk series</li>
            <li>Track improvement: aim to move from 34% → 50% by end of academic year</li>
          </ul>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge bm">Current: 34% exposure</span>
        <span class="badge bl">NEP Target: 50% by 2025</span>
        <span class="badge bb">~58 students to counsel now</span>
        <span class="badge bp">NSQF alignment recommended</span>
      </div>
    </div></div>
  </div>

  <div class="modal-bg" id="modal-nep6">
    <div class="modal"><div class="modal-head"><h3>⚠ Experiential Learning &amp; Field Trips — NEP §4.6, §7.9</h3><button class="modal-close" onclick="closeModal('nep6')">✕ Close</button></div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px;background:#FEF2F2;border-color:#FECACA"><span style="color:#991B1B">⚠</span><span style="color:#991B1B"><strong>No experiential field trips scheduled this academic year.</strong> NEP mandates a minimum of 10 bagless days per year. CBSE requires career-exploration events in the Annual Activity Calendar.</span></div>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">What the policy requires</div>
      <ul style="font-size:12px;line-height:1.8;color:var(--text);padding-left:18px;margin-bottom:14px">
        <li>Minimum 10 bagless days per year — hands-on, activity-based learning inside or outside school</li>
        <li>At least 2 career-exploration visits per academic year per grade group</li>
        <li>Annual Activity Calendar submitted to CBSE must include career-linked field trip dates</li>
        <li>Community engagement activities — local craftspeople, farmers, healthcare workers visiting school</li>
        <li>Reflection documentation: what did students learn? How did it change their understanding?</li>
      </ul>
      <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:8px">Profile-matched trip planning — why counsellor involvement is mandatory</div>
      <div style="background:#FEF2F2;border-left:3px solid var(--danger);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;font-size:12px;line-height:1.7;color:#991B1B;margin-bottom:10px">
        Generic tours (e.g., "everyone visits a factory") have minimal career-clarity impact. Navigator data shows that students with Medical aspiration need to visit a hospital; Realistic students need to visit a manufacturing plant; Artistic students need an art studio or media house. A counsellor-planned trip, matched to class profiles, produces measurably higher CCI improvement in the following assessment cycle.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:700;color:var(--pd);margin-bottom:6px">🗺 Navigator-Aligned Trip Ideas</div>
          <div style="font-size:11px;line-height:1.7;color:var(--text)">
            <strong>Gr 6–8:</strong> Science museum, agricultural farm, art gallery, newspaper printing press, crafts centre<br><br>
            <strong>Gr 9–10:</strong> Hospital / medical college, IT company campus, court visit, college open days, engineering workshop<br><br>
            <strong>Gr 11 Science:</strong> Research institute, pharmacy, IIT/NIT open day, environmental field station, biotech lab<br><br>
            <strong>Gr 11 Commerce/Arts:</strong> Stock exchange, ad agency, art institute, NGO headquarters, hotel management college
          </div>
        </div>
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:700;color:var(--pd);margin-bottom:6px">🧠 Counsellor's Role — 3-Step Process</div>
          <div style="font-size:11px;line-height:1.75;color:var(--text)">
            <strong>Step 1 — Before the trip:</strong> Counsellor reviews class Navigator data, identifies which students benefit most, selects destination, conducts 15-min orientation session connecting the visit to personal profiles.<br><br>
            <strong>Step 2 — During the trip:</strong> Counsellor provides each student a 3-question observation card linked to their top career match. Encourages them to look for specific things.<br><br>
            <strong>Step 3 — After the trip:</strong> Counsellor facilitates 20-min reflection, updates aspiration notes, records CCI shifts. Tracks whether the visit raised, lowered, or clarified aspirations.
          </div>
        </div>
      </div>
      <div style="background:var(--pd);color:#fff;border-radius:var(--rs);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:700;margin-bottom:3px">📩 Involve the counsellor to plan profile-matched field trips</div>
          <div style="font-size:11px;opacity:.85">Select a grade group, add context, and send directly to the Counsellor's inbox. Counsellor will review Navigator data and suggest destinations.</div>
        </div>
        <button onclick="closeModal('nep6');openModal('fieldTripModal')" class="btn btn-primary" style="background:var(--s);border-color:var(--s);white-space:nowrap;font-size:12px">🗺 Plan Field Trip with Counsellor →</button>
      </div>
    </div></div>
  </div>
  </div>

  <!-- Field Trip Modal -->
  <div class="modal-bg" id="modal-fieldTripModal">
    <div class="modal">
      <div class="modal-head"><h3>🗺 Plan Experiential Field Trips — Counsellor Coordination</h3><button class="modal-close" onclick="closeModal('fieldTripModal')">✕ Close</button></div>
      <div class="modal-body">
        <div class="insight" style="margin-bottom:16px"><span>🧠</span><span>The counsellor has access to grade-level Navigator data including dominant personalities, learning styles, and career aspirations — essential for choosing the right destination for each class.</span></div>
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:600;color:var(--pd);margin-bottom:10px">Step-by-step: How to Plan a Profile-Matched Field Trip</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">1</div>
              <div><div style="font-size:12px;font-weight:600;color:var(--text)">Principal selects grade group &amp; tentative dates</div><div style="font-size:11px;color:var(--muted)">Decide which classes and how many bagless days to allocate. Inform counsellor at least 3 weeks in advance.</div></div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">2</div>
              <div><div style="font-size:12px;font-weight:600;color:var(--text)">Counsellor analyses Navigator data for the grade</div><div style="font-size:11px;color:var(--muted)">Reviews dominant personality, top aspirations, and suitability clusters to recommend 2–3 destination options that match the class profile.</div></div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">3</div>
              <div><div style="font-size:12px;font-weight:600;color:var(--text)">Counsellor conducts pre-trip orientation session (15 min)</div><div style="font-size:11px;color:var(--muted)">"Today we visit [X]. Your Navigator data shows you have strengths in [Y]. Look out for [Z] during the visit." Personalises the experience.</div></div>
            </div>
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div style="width:24px;height:24px;border-radius:50%;background:var(--p);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">4</div>
              <div><div style="font-size:12px;font-weight:600;color:var(--text)">Post-trip reflection &amp; CCI update</div><div style="font-size:11px;color:var(--muted)">Counsellor runs a 20-min debrief. Students update their aspiration checklist. Counsellor notes any clarity shifts in session records.</div></div>
            </div>
          </div>
        </div>
        <div style="background:#FEF3C7;border-radius:var(--rs);padding:12px;font-size:12px;color:#92400E;margin-bottom:14px">
          <strong>Send a planning request to Counsellor now:</strong>
        </div>
        <select class="fsel" id="ftGrade" style="width:100%;margin-bottom:8px">
          <option>Select Grade Group</option>
          <option>Grade 6–8 (Insight Navigator)</option>
          <option>Grade 9–10 (Subject Navigator)</option>
          <option>Grade 11–12 (Career Navigator)</option>
        </select>
        <textarea class="note-area" id="ftNote" placeholder="Add context for counsellor — e.g. 'We have budget for 2 visits this semester. Class 9A has many students interested in engineering. Please suggest destinations and prepare a pre-trip orientation.'"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary btn-sm" onclick="sendFieldTripRequest()">📩 Send to Counsellor</button>
          <button class="btn btn-sm" onclick="closeModal('fieldTripModal')">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi-card" onclick="openModal('kpiStudents')">
      <div class="kpi-label">Total Students Assessed</div>
      <div class="kpi-value">487</div>
      <div class="kpi-delta up">↑ 23% vs last year</div>
      <div class="kpi-bar" style="background:var(--s)"></div>
    </div>
    <div class="kpi-card" onclick="openModal('kpiCompletion')">
      <div class="kpi-label">Completion Rate</div>
      <div class="kpi-value red">79%</div>
      <div class="kpi-delta danger">⚠ Below 90% threshold — click to see</div>
      <div class="kpi-bar" style="background:var(--danger)"></div>
    </div>
    <div class="kpi-card" onclick="openModal('kpiCCI')">
      <div class="kpi-label">High Career Clarity (CCI)</div>
      <div class="kpi-value">31%</div>
      <div class="kpi-delta up">↑ 8% vs last cycle</div>
      <div class="kpi-bar" style="background:var(--p)"></div>
    </div>
    <div class="kpi-card" onclick="openModal('kpiSupport')">
      <div class="kpi-label">Students Needing Support</div>
      <div class="kpi-value red">96</div>
      <div class="kpi-delta danger">Low/No CCI — click to see</div>
      <div class="kpi-bar" style="background:var(--danger)"></div>
    </div>
  </div>

  <!-- SCHOOL POTENTIAL section -->
  <div class="section-divider">
    <div class="section-divider-line"></div>
    <div class="section-divider-label school-potential-label">🏫 School's Potential</div>
    <div class="section-divider-line"></div>
  </div>
  <div class="legend">
    <div class="legend-item"><div class="ld" style="background:#0C6B5A"></div>Grade 6–8</div>
    <div class="legend-item"><div class="ld" style="background:#36B37E"></div>Grade 9–10</div>
    <div class="legend-item"><div class="ld" style="background:#F59E0B"></div>Grade 11–12</div>
    <div class="legend-item" style="margin-left:12px"><div class="ld" style="background:#D1FAE5;border:1px solid #059669"></div>Strong (≥70%)</div>
    <div class="legend-item"><div class="ld" style="background:#FEF3C7;border:1px solid #D97706"></div>Moderate (50–70%)</div>
    <div class="legend-item"><div class="ld" style="background:#FEE2E2;border:1px solid #DC2626"></div>Needs Attention (&lt;50%)</div>
  </div>

  <div class="g2 mb14">
    <!-- PERSONALITY with hover tooltip + clickable -->
    <div class="card" id="personalityChartCard" style="cursor:pointer" onclick="openModal('personalityDrill')">
      <div class="card-title">
        Career Personality Profile
        <span style="font-size:9px;background:#EEF2FF;color:#3730A3;padding:2px 6px;border-radius:8px;margin-left:6px">hover for insight · click for guidelines</span>
      </div>
      <div class="legend">
        <div class="legend-item"><div class="ld" style="background:#0C6B5A"></div>Gr 6–8</div>
        <div class="legend-item"><div class="ld" style="background:#36B37E"></div>Gr 9–10</div>
        <div class="legend-item"><div class="ld" style="background:#F59E0B"></div>Gr 11–12</div>
      </div>
      <div class="cw"><canvas id="personalityChart"></canvas></div>
      <div id="personalityTooltipPanel" style="display:none;margin-top:10px;background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px;font-size:11px"></div>
    </div>

    <!-- LEARNING STYLES (renamed from Intelligence Domain) -->
    <div class="card" onclick="openModal('learningStylesDrill')">
      <div class="card-title">Learning Styles — Howard Gardner Model
        <span style="font-size:9px;background:#EEF2FF;color:#3730A3;padding:2px 6px;border-radius:8px;margin-left:6px">click for details</span>
      </div>
      <div class="tscroll">
        <table class="dtable">
          <thead><tr><th>Learning Style</th><th>Gr 6–8</th><th>Gr 9–10</th><th>Gr 11–12</th><th>Trend</th></tr></thead>
          <tbody id="lsHeatmap"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- EXTERNAL MAPPING section -->
  <div class="section-divider">
    <div class="section-divider-line"></div>
    <div class="section-divider-label external-mapping-label">🗺 External Mapping</div>
    <div class="section-divider-line"></div>
  </div>

  <div class="g2 mb14">
    <!-- CCI chart with hover grade breakdown -->
    <div class="card">
      <div class="card-title">Career Clarity Index (CCI) by Grade Group
        <span style="font-size:9px;background:#D1FAE5;color:#065F46;padding:2px 6px;border-radius:8px;margin-left:6px">hover bar for grade-wise split</span>
      </div>
      <div class="legend">
        <div class="legend-item"><div class="ld" style="background:#059669"></div>High</div>
        <div class="legend-item"><div class="ld" style="background:#D97706"></div>Moderate</div>
        <div class="legend-item"><div class="ld" style="background:#DC2626"></div>Low/None</div>
      </div>
      <div class="cw md"><canvas id="cciChart"></canvas></div>
      <div id="cciHoverPanel" style="display:none;margin-top:10px;background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px;font-size:11px"></div>
      <div class="insight"><span>💡</span><span>Grade 11–12 has highest low-clarity (45%). Counselling before stream selection is critical per NEP 2020 §15.6.</span></div>
    </div>

    <!-- ASPIRATION vs SUITABILITY with click drill -->
    <div class="card" style="cursor:pointer" onclick="openModal('aspirationDrill')">
      <div class="card-title">Aspiration vs Suitability Gap
        <span style="font-size:9px;background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:8px;margin-left:6px">click for grade-wise + activities</span>
      </div>
      <div class="legend">
        <div class="legend-item"><div class="ld" style="background:#0C6B5A88"></div>Aspiration %</div>
        <div class="legend-item"><div class="ld" style="background:#F59E0B88"></div>Suitability %</div>
      </div>
      <div class="cw tall"><canvas id="gapChart"></canvas></div>
    </div>
  </div>
</div>

<!-- ════════════════ TEACHER ════════════════ -->
<div id="dash-teacher" class="dash">
  <div class="section-header">
    <div class="section-title">Classroom Intelligence Panel</div>
    <div class="section-sub">Plan activities · Track flags · Compare sections · Send notes to counsellor</div>
  </div>

  <div class="filter-row">
    <span class="flabel">Class:</span>
    <select class="fsel" id="classSelector" onchange="updateTeacherDash()">
      <option value="9A">Grade 9 – Section A</option>
      <option value="9B">Grade 9 – Section B</option>
      <option value="10A">Grade 10 – Section A</option>
      <option value="10B">Grade 10 – Section B</option>
      <option value="11A">Grade 11 – Section A</option>
      <option value="11S">Grade 11 – Science</option>
    </select>
    <label style="font-size:11px;display:flex;align-items:center;gap:5px;cursor:pointer;color:var(--danger);font-weight:600;margin-left:6px">
      <input type="checkbox" id="redFlagOnly" onchange="updateTeacherDash()"> Red Flags Only
    </label>
    <div id="classSummaryBadges" style="margin-left:auto;display:flex;gap:5px;flex-wrap:wrap"></div>
  </div>

  <div class="g2 mb14">
    <!-- Learning Styles of class -->
    <div class="card">
      <div class="card-title">Learning Styles of This Class</div>
      <div class="cw"><canvas id="teacherIntelChart"></canvas></div>
      <div id="lsClassInsight" class="insight" style="margin-top:10px"><span>💡</span><span></span></div>
    </div>
    <!-- Ability gaps -->
    <div class="card">
      <div class="card-title">Ability Strengths &amp; Gaps</div>
      <div class="cw"><canvas id="teacherAbilChart"></canvas></div>
      <div class="legend" style="margin-top:8px">
        <div class="legend-item"><div class="ld" style="background:#36B37E"></div>Strong (≥60%)</div>
        <div class="legend-item"><div class="ld" style="background:#F59E0B"></div>Moderate</div>
        <div class="legend-item"><div class="ld" style="background:#EF4444"></div>Gap (&lt;40%)</div>
      </div>
    </div>
  </div>

  <!-- SECTION COMPARISON + total -->
  <div class="g21 mb14">
    <div class="card">
      <div class="card-title">Students in <span id="classLabelH" style="color:var(--pd)">Grade 9A</span> &nbsp;
        <span id="totalStudentsBadge" class="badge bt"></span>
      </div>
      <div class="tscroll">
        <table class="dtable">
          <thead>
            <tr><th>Student</th><th>Personality</th><th>Learning Style</th><th>Ability Gap</th><th>CCI</th><th>Support</th><th>Report Card</th></tr>
          </thead>
          <tbody id="teacherStudentTable"></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Section Comparison — Same Grade</div>
      <div id="sectionComparison" style="margin-bottom:14px"></div>
      <div class="card-title" style="margin-top:10px">My Section Ranks</div>
      <div id="sectionRanks"></div>
    </div>
  </div>

  <div class="g2 mb14">
    <!-- Strategies -->
    <div class="card">
      <div class="card-title">Recommended Classroom Strategies</div>
      <div class="strat-grid" id="strategyGrid"></div>
    </div>
    <!-- Notes to counsellor -->
    <div class="card">
      <div class="card-title">📨 Notes to Counsellor</div>
      <div id="teacherNotesSent" style="margin-bottom:10px;max-height:140px;overflow-y:auto"></div>
      <select class="fsel" id="noteStudentSelect" style="width:100%;margin-bottom:7px">
        <option value="">Select student (optional, for specific case)</option>
      </select>
      <textarea class="note-area" id="teacherNoteText" placeholder="Write a note to counsellor about a student or class concern..."></textarea>
      <div style="display:flex;gap:7px;margin-top:7px">
        <button class="btn btn-primary btn-sm" onclick="sendTeacherNote()">Send to Counsellor</button>
        <button class="btn btn-sm" onclick="document.getElementById('teacherNoteText').value=''">Clear</button>
      </div>
    </div>
  </div>
</div>

<!-- ════════════════ COUNSELLOR ════════════════ -->
<div id="dash-counsellor" class="dash">
  <div class="section-header">
    <div class="section-title">Counsellor's Command Centre</div>
    <div class="section-sub">Grade &amp; section filter · Individual profiles · Session notes · Messages from principal &amp; teachers</div>
  </div>

  <!-- FILTER BAR -->
  <div class="filter-row" style="margin-bottom:14px">
    <span class="flabel">Filter by Grade:</span>
    <select class="fsel" id="cGradeFilter" onchange="counsellorFilter()">
      <option value="all">All Grades</option>
      <option value="6">Grade 6</option>
      <option value="7">Grade 7</option>
      <option value="8">Grade 8</option>
      <option value="9">Grade 9</option>
      <option value="10">Grade 10</option>
      <option value="11">Grade 11</option>
      <option value="12">Grade 12</option>
    </select>
    <span class="flabel">Section:</span>
    <select class="fsel" id="cSectionFilter" onchange="counsellorFilter()">
      <option value="all">All Sections</option>
      <option value="A">Section A</option>
      <option value="B">Section B</option>
      <option value="S">Section S (Science)</option>
    </select>
    <span class="flabel">Personality:</span>
    <select class="fsel" id="cPersonFilter" onchange="counsellorFilter()">
      <option value="all">All Types</option>
      <option value="Realistic">Realistic</option>
      <option value="Investigative">Investigative</option>
      <option value="Artistic">Artistic</option>
      <option value="Social">Social</option>
      <option value="Enterprising">Enterprising</option>
      <option value="Conventional">Conventional</option>
    </select>
    <span id="filterCount" class="badge bt" style="margin-left:8px"></span>
  </div>

  <!-- NOTIFICATIONS from teachers/principal -->
  <div class="notif-panel" id="counsellorNotifPanel">
    <div class="notif-panel-title">
      📬 Messages from Principal &amp; Teachers
      <span class="badge br" id="unreadBadge">3 unread</span>
    </div>
    <div id="counsellorMessages"></div>
    <div style="margin-top:10px">
      <div class="card-title" style="margin-bottom:6px;font-size:10px">Send Reply to Principal / Teacher</div>
      <select class="fsel" id="replyTarget" style="margin-bottom:6px;width:100%">
        <option value="">Select recipient...</option>
        <option value="principal">Principal</option>
        <option value="teacher9A">Teacher – Grade 9A</option>
        <option value="teacher9B">Teacher – Grade 9B</option>
        <option value="teacher10A">Teacher – Grade 10A</option>
        <option value="teacher10B">Teacher – Grade 10B</option>
        <option value="teacher11A">Teacher – Grade 11A</option>
        <option value="teacher11S">Teacher – Grade 11S</option>
      </select>
      <textarea class="note-area" id="replyText" placeholder="Type your reply or message..."></textarea>
      <div style="display:flex;gap:7px;margin-top:7px">
        <button class="btn btn-primary btn-sm" onclick="sendReply()">Send Reply</button>
        <button class="btn btn-sm" onclick="document.getElementById('replyText').value=''">Clear</button>
      </div>
    </div>
  </div>

  <!-- AGGREGATE CHARTS -->
  <div class="g3 mb14">
    <div class="card">
      <div class="card-title">Personality Distribution</div>
      <div class="cw"><canvas id="cPersonChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">CCI — Filtered Students</div>
      <div class="cw"><canvas id="cCCIChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">Top Aspirations</div>
      <div id="topAsp"></div>
    </div>
  </div>

  <!-- STUDENT LIST + DETAIL -->
  <div class="cl-layout">
    <div class="slist-panel">
      <div class="slist-head">
        <input class="ssearch" type="text" placeholder="Search student..." oninput="filterSList(this.value)" id="sSearchInput">
        <div class="cci-tabs">
          <span class="ctab ctab-all" onclick="setCCIFilter('all',this)">All</span>
          <span class="ctab" onclick="setCCIFilter('High',this)">High</span>
          <span class="ctab" onclick="setCCIFilter('Moderate',this)">Moderate</span>
          <span class="ctab" onclick="setCCIFilter('Low',this)">Low/None</span>
        </div>
      </div>
      <div class="slist" id="studentList"></div>
    </div>

    <div class="sdetail">
      <div class="card" id="studentDetailCard">
        <div style="text-align:center;padding:40px;color:var(--muted)">
          <div style="font-size:30px;margin-bottom:8px">🧠</div>
          <div style="font-size:12px">Select a student to view their profile</div>
        </div>
      </div>
      <div class="card" id="sessionNotesCard">
        <div class="card-title">Session Notes</div>
        <div id="notesList" style="margin-bottom:9px;max-height:160px;overflow-y:auto"></div>
        <textarea class="note-area" id="newNoteText" placeholder="Add session note..."></textarea>
        <div style="display:flex;gap:7px;margin-top:7px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="saveNote()">Save Note</button>
          <button class="btn btn-sm" onclick="document.getElementById('newNoteText').value=''">Clear</button>
          <button class="btn btn-sm" onclick="downloadReport('counsellor')" style="margin-left:auto;background:#084A3E;color:#fff;border-color:#084A3E">📥 Download Report</button>
        </div>
      </div>

      <!-- APPOINTMENT CALENDAR -->
      <div class="card">
        <div class="card-title">📅 Appointment Calendar</div>
        <div class="cal-wrap">
          <div class="cal-header">
            <button class="cal-nav" onclick="calNav(-1)">‹ Prev</button>
            <div class="cal-month" id="calMonth"></div>
            <button class="cal-nav" onclick="calNav(1)">Next ›</button>
          </div>
          <div class="cal-grid">
            <div class="cal-day-label">Su</div><div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div><div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div><div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
          </div>
          <div class="cal-grid" id="calDays"></div>
          <div class="appt-list" id="apptList">
            <div style="font-size:11px;color:var(--muted);text-align:center;padding:10px">Click a date to view or add appointments</div>
          </div>
        </div>
        <!-- Book new appointment form -->
        <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
          <div class="card-title" style="margin-bottom:7px;font-size:10px">Book New Appointment</div>
          <select class="fsel" id="apptStudentSel" style="width:100%;margin-bottom:6px">
            <option value="">Select student...</option>
          </select>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <input type="date" id="apptDate" class="fsel" style="flex:1">
            <select class="fsel" id="apptTime" style="flex:1">
              <option value="9:00 AM">9:00 AM</option><option value="9:30 AM">9:30 AM</option>
              <option value="10:00 AM">10:00 AM</option><option value="10:30 AM">10:30 AM</option>
              <option value="11:00 AM">11:00 AM</option><option value="11:30 AM">11:30 AM</option>
              <option value="12:00 PM">12:00 PM</option><option value="2:00 PM">2:00 PM</option>
              <option value="2:30 PM">2:30 PM</option><option value="3:00 PM">3:00 PM</option>
              <option value="3:30 PM">3:30 PM</option><option value="4:00 PM">4:00 PM</option>
            </select>
          </div>
          <select class="fsel" id="apptType" style="width:100%;margin-bottom:7px">
            <option>Career Counselling Session</option>
            <option>CCI Review</option>
            <option>Stream Selection Guidance</option>
            <option>Parent + Student Session</option>
            <option>Follow-up Session</option>
            <option>Red Flag Intervention</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="bookAppt()" style="width:100%;justify-content:center;display:flex">📅 Book Appointment</button>
          <div id="apptBookedMsg" style="display:none;margin-top:7px;background:#D1FAE5;border-radius:var(--rs);padding:7px 10px;font-size:11px;color:#065F46;font-weight:500"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ════════════════ STUDENT ════════════════ -->
<div id="dash-student" class="dash">
  <div class="prof-header">
    <div class="avatar">AS</div>
    <div style="flex:1">
      <div class="prof-name">Aarav Sharma</div>
      <div class="prof-info">Grade 10A · Sunrise Public School · Navigator 360: Complete</div>
      <div class="stags">
        <span class="stag">Logical Thinking</span><span class="stag">Problem Solving</span>
        <span class="stag">Curiosity</span><span class="stag">Creativity</span>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;opacity:.7;margin-bottom:4px">Career Clarity Index</div>
      <div style="font-size:20px;font-weight:700;background:rgba(255,255,255,0.2);padding:6px 12px;border-radius:8px">HIGH ⭐</div>
    </div>
  </div>

  <div class="g2 mb14">
    <div class="card">
      <div class="card-title">Your Navigator 360 Profile</div>
      <div class="cw" style="display:flex;justify-content:center"><canvas id="studentRadarChart" style="max-height:200px;max-width:260px"></canvas></div>
      <div style="margin-top:12px">
        <div class="prow"><span class="plabel">Career Personality</span><div style="flex:1"><div class="pb"><div class="pf" style="width:78%;background:var(--p)"></div></div></div><span class="pval">78%</span></div>
        <div class="prow"><span class="plabel">Learning Styles</span><div style="flex:1"><div class="pb"><div class="pf" style="width:82%;background:var(--s)"></div></div></div><span class="pval">82%</span></div>
        <div class="prow"><span class="plabel">Ability</span><div style="flex:1"><div class="pb"><div class="pf" style="width:71%;background:var(--p)"></div></div></div><span class="pval">71%</span></div>
        <div class="prow"><span class="plabel">Values</span><div style="flex:1"><div class="pb"><div class="pf" style="width:85%;background:var(--acc)"></div></div></div><span class="pval">85%</span></div>
        <div class="prow"><span class="plabel">Subjects Interest</span><div style="flex:1"><div class="pb"><div class="pf" style="width:74%;background:var(--s)"></div></div></div><span class="pval">74%</span></div>
        <div class="prow"><span class="plabel">Aspirations</span><div style="flex:1"><div class="pb"><div class="pf" style="width:68%;background:var(--info)"></div></div></div><span class="pval">68%</span></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Top Career Matches</div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:10px">
        <div style="border:1px solid var(--border);border-left:4px solid var(--p);border-radius:var(--rs);padding:11px">
          <div style="font-size:10px;font-weight:700;color:var(--muted)">🥇 Best Match — 9/9</div>
          <div style="font-size:14px;font-weight:600;color:var(--pd);margin:3px 0">Computer Science &amp; IT</div>
          <div style="font-size:11px;color:var(--muted)">Logical-Mathematical · Technical · Investigative</div>
          <div style="margin-top:6px;display:flex;gap:4px"><span class="badge bt">B.Tech CS</span><span class="badge bb">Data Science</span><span class="badge bp">AI/ML</span></div>
        </div>
        <div style="border:1px solid var(--border);border-left:4px solid var(--s);border-radius:var(--rs);padding:11px">
          <div style="font-size:10px;font-weight:700;color:var(--muted)">🥈 Strong — 8/9</div>
          <div style="font-size:14px;font-weight:600;color:var(--pd);margin:3px 0">Science &amp; Mathematics</div>
          <div style="font-size:11px;color:var(--muted)">Computational · Logical reasoning · Realistic</div>
        </div>
        <div style="border:1px solid var(--border);border-left:4px solid var(--acc);border-radius:var(--rs);padding:11px">
          <div style="font-size:10px;font-weight:700;color:var(--muted)">🥉 Good — 7/9</div>
          <div style="font-size:14px;font-weight:600;color:var(--pd);margin:3px 0">Engineering &amp; Technology</div>
          <div style="font-size:11px;color:var(--muted)">Technical · Form perception · Realistic</div>
        </div>
      </div>
      <div class="insight"><span>💡</span><span>Your creativity opens doors in UX Design and Product Management alongside technical roles.</span></div>
    </div>
  </div>

  <!-- STUDENT ACTION ROW: QR + Book Appointment + Download -->
  <div class="g3 mb14">
    <!-- Career Library QR -->
    <div class="card" style="text-align:center">
      <div class="card-title">📚 Explore Career Library</div>
      <div style="margin:8px auto;width:110px;height:110px;background:#fff;border:2px solid var(--border);border-radius:var(--rs);display:flex;align-items:center;justify-content:center;padding:6px">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <rect x="4" y="4" width="34" height="34" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
          <rect x="12" y="12" width="18" height="18" fill="#084A3E" rx="1"/>
          <rect x="58" y="4" width="34" height="34" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
          <rect x="66" y="12" width="18" height="18" fill="#084A3E" rx="1"/>
          <rect x="4" y="58" width="34" height="34" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
          <rect x="12" y="66" width="18" height="18" fill="#084A3E" rx="1"/>
          <rect x="58" y="58" width="10" height="10" fill="#084A3E" rx="1"/>
          <rect x="72" y="58" width="10" height="10" fill="#084A3E" rx="1"/>
          <rect x="58" y="72" width="10" height="10" fill="#084A3E" rx="1"/>
          <rect x="72" y="72" width="20" height="10" fill="#084A3E" rx="1"/>
          <rect x="44" y="4" width="6" height="6" fill="#084A3E"/>
          <rect x="44" y="14" width="6" height="6" fill="#084A3E"/>
          <rect x="44" y="44" width="6" height="6" fill="#084A3E"/>
          <rect x="4" y="44" width="6" height="6" fill="#084A3E"/>
          <rect x="14" y="44" width="6" height="6" fill="#084A3E"/>
          <rect x="24" y="44" width="6" height="6" fill="#084A3E"/>
        </svg>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Scan to visit the Career-9 Library — explore 200+ career paths, college options, and day-in-the-life videos matched to your profile.</div>
      <a href="https://www.career-9.com" target="_blank" class="btn btn-primary" style="font-size:11px;display:inline-flex;align-items:center;gap:5px;text-decoration:none">🔗 Open Career Library</a>
    </div>

    <!-- Book Counselling Appointment -->
    <div class="card">
      <div class="card-title">🗓 Book a Counselling Session</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:12px">Your Career Clarity Index is <strong style="color:var(--s)">HIGH</strong>, but a one-on-one session with your school counsellor can help you explore your top matches more deeply, compare college options, and create a concrete action plan for Grade 11 stream selection.</div>
      <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--pd);margin-bottom:6px">Next Available Slots</div>
        <div style="display:flex;flex-direction:column;gap:5px" id="studentApptSlots"></div>
      </div>
      <button onclick="bookStudentAppt()" class="btn btn-primary" style="width:100%;font-size:11px;justify-content:center;display:flex;gap:6px">📅 Request Appointment</button>
      <div id="apptConfirm" style="display:none;margin-top:8px;background:#D1FAE5;border-radius:var(--rs);padding:8px 10px;font-size:11px;color:#065F46;font-weight:500"></div>
    </div>

    <!-- Download Report -->
    <div class="card">
      <div class="card-title">📥 Your Reports</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:600;color:var(--pd)">Navigator 360 Full Report</div>
          <div style="font-size:10px;color:var(--muted);margin:3px 0 8px">Complete 6-pillar profile · Career matches · Action plan</div>
          <button onclick="downloadReport('full')" class="dl-btn" style="font-size:11px;width:100%;justify-content:center">📄 Download Full Report</button>
        </div>
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:600;color:var(--pd)">Career Clarity Summary (1 page)</div>
          <div style="font-size:10px;color:var(--muted);margin:3px 0 8px">Top 3 careers · Key strengths · 30-day actions</div>
          <button onclick="downloadReport('summary')" class="dl-btn" style="font-size:11px;width:100%;justify-content:center">📄 Download Summary</button>
        </div>
        <div style="background:#F8FDFB;border:1px solid var(--border);border-radius:var(--rs);padding:10px">
          <div style="font-size:11px;font-weight:600;color:var(--pd)">Share with Parents</div>
          <div style="font-size:10px;color:var(--muted);margin:3px 0 8px">Parent-friendly version with next steps</div>
          <button onclick="downloadReport('parent')" class="dl-btn" style="background:#7C3AED;font-size:11px;width:100%;justify-content:center">📤 Share with Parents</button>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- ════════════════ MODALS ════════════════ -->
<!-- Total Students Modal -->
<div class="modal-bg" id="modal-kpiStudents">
  <div class="modal">
    <div class="modal-head"><h3>Grade-wise Student Assessment Breakdown</h3><button class="modal-close" onclick="closeModal('kpiStudents')">✕ Close</button></div>
    <div class="modal-body">
      <div class="grade-comp-grid" id="kpiStudentsGrid"></div>
      <div style="margin-top:18px"><canvas id="kpiStudentsChart" style="max-height:220px"></canvas></div>
    </div>
  </div>
</div>

<!-- Completion Rate Modal -->
<div class="modal-bg" id="modal-kpiCompletion">
  <div class="modal">
    <div class="modal-head">
      <h3>⚠ Completion Rate Below 90% — Grade-wise Details</h3>
      <button class="modal-close" onclick="closeModal('kpiCompletion')">✕ Close</button>
    </div>
    <div class="modal-body">
      <div class="insight" style="margin-bottom:14px;background:#FEE2E2;border-color:#FECACA"><span>⚠</span><span style="color:#991B1B">Target is ≥90% completion. Grades highlighted in red are significantly below threshold. Counsellor and class teachers should follow up.</span></div>
      <table class="dtable">
        <thead><tr><th>Grade</th><th>Section</th><th>Total Students</th><th>Completed</th><th>Completion %</th><th>Missing Students</th><th>Status</th></tr></thead>
        <tbody id="completionTable"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- CCI Drill Modal -->
<div class="modal-bg" id="modal-kpiCCI">
  <div class="modal">
    <div class="modal-head"><h3>Career Clarity Index — Grade-wise Breakdown</h3><button class="modal-close" onclick="closeModal('kpiCCI')">✕ Close</button></div>
    <div class="modal-body">
      <div class="g2" style="margin-bottom:16px">
        <div><canvas id="kpiCCIChart" style="max-height:220px"></canvas></div>
        <div class="grade-comp-grid" id="kpiCCIGrid"></div>
      </div>
    </div>
  </div>
</div>

<!-- Support Students Modal -->
<div class="modal-bg" id="modal-kpiSupport">
  <div class="modal">
    <div class="modal-head"><h3>Students Needing Support — Grade-wise</h3><button class="modal-close" onclick="closeModal('kpiSupport')">✕ Close</button></div>
    <div class="modal-body">
      <div class="grade-comp-grid" id="kpiSupportGrid" style="margin-bottom:14px"></div>
      <table class="dtable">
        <thead><tr><th>Student</th><th>Grade</th><th>Class</th><th>CCI</th><th>Key Gap</th></tr></thead>
        <tbody id="kpiSupportTable"></tbody>
      </table>
    </div>
  </div>
</div>

<!-- Personality Drill Modal -->
<div class="modal-bg" id="modal-personalityDrill">
  <div class="modal">
    <div class="modal-head"><h3>Personality Insights — School Guidelines &amp; Workshops</h3><button class="modal-close" onclick="closeModal('personalityDrill')">✕ Close</button></div>
    <div class="modal-body" id="personalityDrillBody"></div>
  </div>
</div>

<!-- Learning Styles Drill Modal -->
<div class="modal-bg" id="modal-learningStylesDrill">
  <div class="modal">
    <div class="modal-head"><h3>Learning Styles — Howard Gardner Model Details</h3><button class="modal-close" onclick="closeModal('learningStylesDrill')">✕ Close</button></div>
    <div class="modal-body" id="lsDrillBody"></div>
  </div>
</div>

<!-- Aspiration Drill Modal -->
<div class="modal-bg" id="modal-aspirationDrill">
  <div class="modal">
    <div class="modal-head"><h3>Aspiration vs Suitability — Grade-wise Suggestions &amp; Activities</h3><button class="modal-close" onclick="closeModal('aspirationDrill')">✕ Close</button></div>
    <div class="modal-body" id="aspirationDrillBody"></div>
  </div>
</div>

<!-- Report Card Summary Modal -->
<div class="modal-bg" id="modal-reportCard">
  <div class="modal">
    <div class="modal-head">
      <h3>📝 Academic Report Card — Career Navigator Summary</h3>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="copyReportCard()">📋 Copy Text</button>
        <button class="modal-close" onclick="closeModal('reportCard')">✕ Close</button>
      </div>
    </div>
    <div class="modal-body" id="reportCardBody"></div>
  </div>
</div>

`;

const CHART_JS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
const DASHBOARD_SCRIPT_SRC = "/career-navigator-school-dashboard.js";

const SchoolDashboardPage: FC = () => {
  useEffect(() => {
    const previousBodyBg = document.body.style.background;
    document.body.style.background = "#F2F7F5";

    const chartScript = document.createElement("script");
    chartScript.src = CHART_JS_SRC;
    chartScript.async = false;
    chartScript.dataset.schoolDashboard = "chart";

    let appScript: HTMLScriptElement | null = null;

    chartScript.onload = () => {
      appScript = document.createElement("script");
      appScript.src = DASHBOARD_SCRIPT_SRC;
      appScript.async = false;
      appScript.dataset.schoolDashboard = "app";
      document.body.appendChild(appScript);
    };

    document.head.appendChild(chartScript);

    return () => {
      document.body.style.background = previousBodyBg;
      if (chartScript.parentNode) chartScript.parentNode.removeChild(chartScript);
      if (appScript && appScript.parentNode) appScript.parentNode.removeChild(appScript);
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SCHOOL_DASHBOARD_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: SCHOOL_DASHBOARD_BODY }} />
    </>
  );
};

export default SchoolDashboardPage;
