// ═══════════════════════════════════════════════════════════════════════════
// Navigator 360 — Report Component
// Renders the full Navigator 360 report as styled HTML
// Supports: Preview in modal, Download as PDF
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchNavigator360Scores } from './Navigator360API';
import {
  computeNavigator360,
  riasecDisplayName,
  abilityDisplayName,
  miDisplayName,
  levelColor,
  stanineLabel,
} from './Navigator360Engine';
import { Navigator360Result, ScoredDimension, CareerMatch, FlagInfo } from './Navigator360Types';
import { htmlToPdfBlob } from '../../ReportGeneration/utils/htmlToPdf';

// ═══════════════════════ COLORS & STYLES ═══════════════════════

const BRAND = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  accent: '#4361ee',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  bg: '#f8fafc',
  cardBg: '#ffffff',
  border: '#e2e8f0',
  text: '#1a202c',
  textMuted: '#64748b',
};

const RIASEC_COLORS: Record<string, string> = {
  R: '#e53e3e', I: '#3182ce', A: '#9f7aea', S: '#38a169', E: '#dd6b20', C: '#319795',
};

const MI_COLORS = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795', '#3182ce', '#805ad5', '#9f7aea'];
const ABILITY_COLORS = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#2d9cdb', '#319795', '#3182ce', '#6366f1', '#805ad5', '#9f7aea'];

// ═══════════════════════ SUB-COMPONENTS ═══════════════════════

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20, borderBottom: `3px solid ${BRAND.accent}`, paddingBottom: 8 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: BRAND.primary }}>{title}</h2>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: BRAND.textMuted }}>{subtitle}</p>}
    </div>
  );
}

function ScoreCard({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ textAlign: 'center', flex: '1 1 120px', minWidth: 100 }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', margin: '0 auto 8px',
        background: `conic-gradient(${color} ${pct * 3.6}deg, ${BRAND.border} 0deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 18, color: BRAND.text,
        }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: BRAND.textMuted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 10, color: BRAND.textMuted }}>/ {max}</div>
    </div>
  );
}

function HBar({ label, value, max, color, showLabel = true }: {
  label: string; value: number; max: number; color: string; showLabel?: boolean;
}) {
  const pct = Math.max(2, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      {showLabel && (
        <div style={{ width: 140, fontSize: 12, fontWeight: 500, color: BRAND.text, textAlign: 'right' }}>{label}</div>
      )}
      <div style={{ flex: 1, height: 18, background: BRAND.border, borderRadius: 9, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 9,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ width: 36, fontSize: 12, fontWeight: 600, color: BRAND.text, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

function DimensionTable({ dims, colorFn, displayFn, maxRaw }: {
  dims: ScoredDimension[];
  colorFn: (name: string, idx: number) => string;
  displayFn: (name: string) => string;
  maxRaw: number;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: BRAND.bg }}>
          <th style={{ ...thS, width: '25%' }}>Domain</th>
          <th style={{ ...thS, width: '12%' }}>Raw</th>
          <th style={{ ...thS, width: '12%' }}>Norm %</th>
          <th style={{ ...thS, width: '10%' }}>Stanine</th>
          <th style={{ ...thS, width: '15%' }}>Level</th>
          <th style={{ ...thS, width: '26%' }}>Bar</th>
        </tr>
      </thead>
      <tbody>
        {dims.map((d, i) => (
          <tr key={d.name} style={{ borderBottom: `1px solid ${BRAND.border}` }}>
            <td style={{ ...tdS, fontWeight: 600 }}>{displayFn(d.name)}</td>
            <td style={{ ...tdS, textAlign: 'center' }}>{d.rawScore}</td>
            <td style={{ ...tdS, textAlign: 'center' }}>{d.normPct.toFixed(1)}%</td>
            <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{d.stanine}</td>
            <td style={{ ...tdS, textAlign: 'center' }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                fontSize: 10, fontWeight: 600, color: '#fff',
                background: levelColor(d.level),
              }}>{d.level}</span>
            </td>
            <td style={tdS}>
              <div style={{ height: 12, background: BRAND.border, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${(d.rawScore / maxRaw) * 100}%`, height: '100%',
                  borderRadius: 6, background: colorFn(d.name, i),
                }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CareerCard({ match, rank }: { match: CareerMatch; rank: number }) {
  return (
    <div style={{
      border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: 16, marginBottom: 12,
      background: match.isAspiration ? '#f0f9ff' : '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            fontSize: 14, color: '#fff', background: BRAND.accent,
          }}>#{rank}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.primary }}>{match.career.name}</div>
            <div style={{ fontSize: 11, color: BRAND.textMuted }}>
              RIASEC: {match.career.riasec.join('-')}
              {match.isAspiration && <span style={{ marginLeft: 8, color: BRAND.accent, fontWeight: 600 }}>Student Aspiration</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: BRAND.accent }}>{match.suitability}%</div>
          <div style={{ fontSize: 10, color: BRAND.textMuted }}>Suitability</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <MiniBar label="Potential Match" value={match.potentialMatch} color={BRAND.success} />
        <MiniBar label="Values Match" value={match.valuesMatch} color={BRAND.warning} />
      </div>
      {match.matchedValues.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: BRAND.textMuted }}>
          Matched values: {match.matchedValues.join(', ')}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 11, color: BRAND.textMuted }}>
        Degree paths: {match.career.degreePaths.join(' | ')}
      </div>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: '1 1 150px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: BRAND.textMuted }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: BRAND.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: FlagInfo }) {
  const bg = flag.severity === 'critical' ? '#fef2f2' : flag.severity === 'warning' ? '#fffbeb' : '#f0f9ff';
  const border = flag.severity === 'critical' ? '#fca5a5' : flag.severity === 'warning' ? '#fcd34d' : '#93c5fd';
  const textColor = flag.severity === 'critical' ? '#991b1b' : flag.severity === 'warning' ? '#92400e' : '#1e40af';
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8, marginBottom: 6,
      background: bg, border: `1px solid ${border}`,
    }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: textColor }}>{flag.code}</span>
      <span style={{ fontSize: 12, color: textColor, marginLeft: 8 }}>{flag.name}</span>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: textColor, opacity: 0.85 }}>{flag.message}</p>
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span key={item} style={{
          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
          background: color + '15', color, border: `1px solid ${color}30`,
        }}>{item}</span>
      ))}
    </div>
  );
}

const thS: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: BRAND.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
};
const tdS: React.CSSProperties = { padding: '8px 10px' };

// ═══════════════════════ REPORT BODY (pure render) ═══════════════════════

function ReportBody({ result }: { result: Navigator360Result }) {
  const versionLabel = result.gradeGroup === '6-8' ? 'Insight Navigator'
    : result.gradeGroup === '9-10' ? 'Subject Navigator' : 'Career Navigator';

  return (
    <div className="page" style={{
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      maxWidth: 800, margin: '0 auto', padding: 40, background: '#fff', color: BRAND.text,
    }}>
      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.secondary} 100%)`,
        borderRadius: 16, padding: '32px 40px', marginBottom: 32, color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Navigator 360</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.85 }}>{versionLabel}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Career Guidance Report</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 20, padding: '16px 24px', background: 'rgba(255,255,255,0.12)',
          borderRadius: 10, display: 'flex', gap: 40, flexWrap: 'wrap',
        }}>
          <div><span style={{ fontSize: 11, opacity: 0.7 }}>Student Name</span><div style={{ fontSize: 16, fontWeight: 600 }}>{result.studentName}</div></div>
          <div><span style={{ fontSize: 11, opacity: 0.7 }}>Class</span><div style={{ fontSize: 16, fontWeight: 600 }}>{result.studentClass}</div></div>
          <div><span style={{ fontSize: 11, opacity: 0.7 }}>Holland Code</span><div style={{ fontSize: 16, fontWeight: 600, letterSpacing: 2 }}>{result.hollandCode}</div></div>
          <div><span style={{ fontSize: 11, opacity: 0.7 }}>CCI</span><div style={{ fontSize: 16, fontWeight: 600 }}>{result.cci}</div></div>
        </div>
      </div>

      {/* ── COMPOSITE SCORES OVERVIEW ── */}
      <div style={{
        display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 300px', border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: BRAND.primary }}>
            Potential Score
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `conic-gradient(${BRAND.accent} ${result.potentialScore.total * 3.6}deg, ${BRAND.border} 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: BRAND.accent }}>{result.potentialScore.total}</span>
                <span style={{ fontSize: 9, color: BRAND.textMuted }}>/ 100</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 }}>
            <ScoreCard label="Personality" value={result.potentialScore.personality} max={25} color={RIASEC_COLORS.R} />
            <ScoreCard label="Intelligence" value={result.potentialScore.intelligence} max={25} color={RIASEC_COLORS.I} />
            <ScoreCard label="Ability" value={result.potentialScore.ability} max={30} color={RIASEC_COLORS.A} />
            <ScoreCard label="Academic" value={result.potentialScore.academic} max={20} color={RIASEC_COLORS.S} />
          </div>
        </div>

        <div style={{ flex: '1 1 300px', border: `1px solid ${BRAND.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: BRAND.primary }}>
            Preference Score
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: `conic-gradient(${BRAND.success} ${result.preferenceScore.total * 3.6}deg, ${BRAND.border} 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 76, height: 76, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
              }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: BRAND.success }}>{result.preferenceScore.total}</span>
                <span style={{ fontSize: 9, color: BRAND.textMuted }}>/ 100</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 }}>
            <ScoreCard label="Values" value={result.preferenceScore.p1Values} max={20} color="#8b5cf6" />
            <ScoreCard label="Aspirations" value={result.preferenceScore.p2Aspirations} max={20} color="#ec4899" />
            <ScoreCard label="Culture" value={result.preferenceScore.p3Culture} max={30} color="#06b6d4" />
            <ScoreCard label="Subjects" value={result.preferenceScore.p4Subjects} max={30} color="#f59e0b" />
          </div>
        </div>
      </div>

      {/* ── ALIGNMENT & CCI ── */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap',
      }}>
        <div style={{
          flex: '1 1 200px', border: `1px solid ${BRAND.border}`, borderRadius: 12,
          padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Alignment Score</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: BRAND.accent }}>{result.alignmentScore}%</div>
          <div style={{ fontSize: 11, color: BRAND.textMuted }}>Profile-Career Consistency</div>
        </div>
        <div style={{
          flex: '1 1 200px', border: `1px solid ${BRAND.border}`, borderRadius: 12,
          padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Career Clarity Index</div>
          <div style={{
            fontSize: 36, fontWeight: 700,
            color: result.cci === 'High' ? BRAND.success : result.cci === 'Moderate' ? BRAND.warning : BRAND.danger,
          }}>{result.cci}</div>
          <div style={{ fontSize: 11, color: BRAND.textMuted }}>Aspiration-Suitability Match</div>
        </div>
        <div style={{
          flex: '1 1 200px', border: `1px solid ${BRAND.border}`, borderRadius: 12,
          padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: BRAND.textMuted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Holland Code</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: BRAND.primary, letterSpacing: 4 }}>{result.hollandCode}</div>
          <div style={{ fontSize: 11, color: BRAND.textMuted }}>
            {result.hollandCode.split('').map((c) => riasecDisplayName(c)).join(' - ')}
          </div>
        </div>
      </div>

      {/* ── SECTION D: RIASEC PERSONALITY ── */}
      <SectionHeader title="Career Personality (RIASEC)" subtitle="Section D — 54 items, Yes/No format" />
      <DimensionTable
        dims={result.riasec}
        colorFn={(name) => RIASEC_COLORS[name] || BRAND.accent}
        displayFn={(name) => `${name} - ${riasecDisplayName(name)}`}
        maxRaw={18}
      />
      <div style={{ height: 24 }} />

      {/* ── SECTION E: ABILITIES ── */}
      <SectionHeader title="Abilities" subtitle="Section E — 30 items (3 per ability), MCQ/SJT format" />
      <DimensionTable
        dims={result.abilities}
        colorFn={(_, i) => ABILITY_COLORS[i % ABILITY_COLORS.length]}
        displayFn={abilityDisplayName}
        maxRaw={12}
      />
      <div style={{ height: 24 }} />

      {/* ── SECTION F: MULTIPLE INTELLIGENCES ── */}
      <SectionHeader title="Multiple Intelligences" subtitle="Section F — 24 items (3 per domain), Likert scale" />
      <DimensionTable
        dims={result.mi}
        colorFn={(_, i) => MI_COLORS[i % MI_COLORS.length]}
        displayFn={miDisplayName}
        maxRaw={12}
      />
      <div style={{ height: 24 }} />

      {/* ── SECTIONS A/B/C: SELECTIONS ── */}
      <SectionHeader title="Student Preferences" subtitle="Sections A, B, C — Checklist selections" />
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ flex: '1 1 200px' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Career Aspirations</h4>
          {result.careerAspirations.length > 0
            ? <TagList items={result.careerAspirations} color={BRAND.accent} />
            : <span style={{ fontSize: 12, color: BRAND.textMuted }}>Not selected</span>}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Work Values</h4>
          {result.values.length > 0
            ? <TagList items={result.values} color={BRAND.success} />
            : <span style={{ fontSize: 12, color: BRAND.textMuted }}>Not selected</span>}
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 8 }}>Subjects of Interest</h4>
          {result.subjectsOfInterest.length > 0
            ? <TagList items={result.subjectsOfInterest} color="#8b5cf6" />
            : <span style={{ fontSize: 12, color: BRAND.textMuted }}>Not selected</span>}
        </div>
      </div>

      {/* ── TOP CAREER MATCHES ── */}
      <SectionHeader
        title={`Top Career Matches (${result.topCareers.length})`}
        subtitle="Ranked by suitability — potential match (60%) + values match (40%) + aspiration bonus"
      />
      {result.topCareers.map((cm, i) => (
        <CareerCard key={cm.career.id} match={cm} rank={i + 1} />
      ))}

      {/* ── ALL CAREER SUITABILITY ── */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: BRAND.primary, marginBottom: 12 }}>
          Complete Career Suitability Ranking
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: BRAND.bg }}>
              <th style={{ ...thS, width: '5%' }}>#</th>
              <th style={thS}>Career Field</th>
              <th style={{ ...thS, width: '12%', textAlign: 'center' }}>Suitability</th>
              <th style={{ ...thS, width: '12%', textAlign: 'center' }}>Potential</th>
              <th style={{ ...thS, width: '12%', textAlign: 'center' }}>Values</th>
              <th style={{ ...thS, width: '8%', textAlign: 'center' }}>Stanine</th>
              <th style={{ ...thS, width: '20%' }}>Bar</th>
            </tr>
          </thead>
          <tbody>
            {result.careerMatches.map((cm, i) => (
              <tr key={cm.career.id} style={{
                borderBottom: `1px solid ${BRAND.border}`,
                background: cm.isAspiration ? '#f0f9ff' : i % 2 === 0 ? '#fff' : BRAND.bg,
              }}>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ ...tdS, fontWeight: 600 }}>
                  {cm.career.name}
                  {cm.isAspiration && <span style={{ fontSize: 9, color: BRAND.accent, marginLeft: 4 }}>ASP</span>}
                </td>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700, color: BRAND.accent }}>{cm.suitability}%</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{cm.potentialMatch}%</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{cm.valuesMatch}%</td>
                <td style={{ ...tdS, textAlign: 'center', fontWeight: 700 }}>{cm.suitability9}</td>
                <td style={tdS}>
                  <div style={{ height: 10, background: BRAND.border, borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      width: `${cm.suitability}%`, height: '100%', borderRadius: 5,
                      background: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accent}aa)`,
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── FLAGS ── */}
      {result.flags.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <SectionHeader title="Psychometric Flags" subtitle="Observations & recommendations for counsellor review" />
          {result.flags.map((f, i) => <FlagBadge key={i} flag={f} />)}
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{
        marginTop: 40, paddingTop: 16, borderTop: `2px solid ${BRAND.border}`,
        display: 'flex', justifyContent: 'space-between', fontSize: 10, color: BRAND.textMuted,
      }}>
        <div>Navigator 360 v1.0 | Career-9 Psychometric Assessment Platform</div>
        <div>Generated: {new Date().toLocaleString('en-IN')}</div>
      </div>
    </div>
  );
}

// ═══════════════════════ REPORT HTML STRING (for PDF) ═══════════════════════

export function generateReportHTML(result: Navigator360Result): string {
  // Build standalone HTML for PDF generation
  const riasecRows = result.riasec.map((d) => `
    <tr>
      <td style="padding:8px 10px;font-weight:600">${d.name} - ${riasecDisplayName(d.name)}</td>
      <td style="padding:8px 10px;text-align:center">${d.rawScore}</td>
      <td style="padding:8px 10px;text-align:center">${d.normPct.toFixed(1)}%</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700">${d.stanine}</td>
      <td style="padding:8px 10px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${levelColor(d.level)}">${d.level}</span></td>
      <td style="padding:8px 10px"><div style="height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden"><div style="width:${(d.rawScore / 18) * 100}%;height:100%;border-radius:6px;background:${RIASEC_COLORS[d.name] || BRAND.accent}"></div></div></td>
    </tr>`).join('');

  const abilityRows = result.abilities.map((d, i) => `
    <tr>
      <td style="padding:8px 10px;font-weight:600">${abilityDisplayName(d.name)}</td>
      <td style="padding:8px 10px;text-align:center">${d.rawScore}</td>
      <td style="padding:8px 10px;text-align:center">${d.normPct.toFixed(1)}%</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700">${d.stanine}</td>
      <td style="padding:8px 10px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${levelColor(d.level)}">${d.level}</span></td>
      <td style="padding:8px 10px"><div style="height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden"><div style="width:${(d.rawScore / 12) * 100}%;height:100%;border-radius:6px;background:${ABILITY_COLORS[i]}"></div></div></td>
    </tr>`).join('');

  const miRows = result.mi.map((d, i) => `
    <tr>
      <td style="padding:8px 10px;font-weight:600">${miDisplayName(d.name)}</td>
      <td style="padding:8px 10px;text-align:center">${d.rawScore}</td>
      <td style="padding:8px 10px;text-align:center">${d.normPct.toFixed(1)}%</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700">${d.stanine}</td>
      <td style="padding:8px 10px;text-align:center"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${levelColor(d.level)}">${d.level}</span></td>
      <td style="padding:8px 10px"><div style="height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden"><div style="width:${(d.rawScore / 12) * 100}%;height:100%;border-radius:6px;background:${MI_COLORS[i]}"></div></div></td>
    </tr>`).join('');

  const careerRows = result.careerMatches.map((cm, i) => `
    <tr style="border-bottom:1px solid #e2e8f0;background:${cm.isAspiration ? '#f0f9ff' : i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:8px 10px;text-align:center;font-weight:600">${i + 1}</td>
      <td style="padding:8px 10px;font-weight:600">${cm.career.name}${cm.isAspiration ? ' <span style="font-size:9px;color:#4361ee">ASP</span>' : ''}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700;color:#4361ee">${cm.suitability}%</td>
      <td style="padding:8px 10px;text-align:center">${cm.potentialMatch}%</td>
      <td style="padding:8px 10px;text-align:center">${cm.valuesMatch}%</td>
      <td style="padding:8px 10px;text-align:center;font-weight:700">${cm.suitability9}</td>
      <td style="padding:8px 10px"><div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden"><div style="width:${cm.suitability}%;height:100%;border-radius:5px;background:linear-gradient(90deg,#4361ee,#4361eeaa)"></div></div></td>
    </tr>`).join('');

  const flagsHtml = result.flags.map((f) => {
    const bg = f.severity === 'critical' ? '#fef2f2' : f.severity === 'warning' ? '#fffbeb' : '#f0f9ff';
    const border = f.severity === 'critical' ? '#fca5a5' : f.severity === 'warning' ? '#fcd34d' : '#93c5fd';
    const color = f.severity === 'critical' ? '#991b1b' : f.severity === 'warning' ? '#92400e' : '#1e40af';
    return `<div style="padding:8px 12px;border-radius:8px;margin-bottom:6px;background:${bg};border:1px solid ${border}">
      <span style="font-weight:700;font-size:12px;color:${color}">${f.code}</span>
      <span style="font-size:12px;color:${color};margin-left:8px">${f.name}</span>
      <p style="margin:4px 0 0;font-size:11px;color:${color};opacity:0.85">${f.message}</p>
    </div>`;
  }).join('');

  const versionLabel = result.gradeGroup === '6-8' ? 'Insight Navigator'
    : result.gradeGroup === '9-10' ? 'Subject Navigator' : 'Career Navigator';

  const tagsHtml = (items: string[], color: string) => items.length > 0
    ? items.map((t) => `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:500;background:${color}15;color:${color};border:1px solid ${color}30;margin:2px 3px">${t}</span>`).join('')
    : '<span style="font-size:12px;color:#64748b">Not selected</span>';

  const scoreCircle = (value: number, max: number, color: string, label: string) => {
    const pct = (value / max) * 100;
    return `<div style="text-align:center;flex:1 1 100px;min-width:80px">
      <div style="width:70px;height:70px;border-radius:50%;margin:0 auto 6px;background:conic-gradient(${color} ${pct * 3.6}deg,#e2e8f0 0deg);display:flex;align-items:center;justify-content:center">
        <div style="width:52px;height:52px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#1a202c">${value}</div>
      </div>
      <div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase">${label}</div>
      <div style="font-size:9px;color:#64748b">/ ${max}</div>
    </div>`;
  };

  const topCareerCards = result.topCareers.map((cm, i) => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;background:${cm.isAspiration ? '#f0f9ff' : '#fff'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;background:#4361ee">#${i + 1}</div>
          <div>
            <div style="font-weight:700;font-size:15px;color:#1a365d">${cm.career.name}</div>
            <div style="font-size:11px;color:#64748b">RIASEC: ${cm.career.riasec.join('-')}${cm.isAspiration ? ' <span style="margin-left:8px;color:#4361ee;font-weight:600">Student Aspiration</span>' : ''}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:700;color:#4361ee">${cm.suitability}%</div>
          <div style="font-size:10px;color:#64748b">Suitability</div>
        </div>
      </div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">Potential: ${cm.potentialMatch}% | Values: ${cm.valuesMatch}%${cm.matchedValues.length > 0 ? ' | Matched: ' + cm.matchedValues.join(', ') : ''}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">Degree paths: ${cm.career.degreePaths.join(' | ')}</div>
    </div>`).join('');

  const thStyle = 'padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Navigator 360 — ${result.studentName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1a202c;background:#f8fafc}
table{border-collapse:collapse;width:100%}@media print{.page{page-break-after:always}}</style></head>
<body>
<div class="page" style="max-width:800px;margin:0 auto;padding:40px;background:#fff">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1a365d 0%,#2b6cb0 100%);border-radius:16px;padding:32px 40px;margin-bottom:32px;color:#fff">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1 style="font-size:28px;font-weight:700">Navigator 360</h1><p style="font-size:14px;opacity:0.85;margin-top:4px">${versionLabel}</p></div>
      <div style="text-align:right"><div style="font-size:13px;opacity:0.8">Career Guidance Report</div><div style="font-size:12px;opacity:0.6;margin-top:2px">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    </div>
    <div style="margin-top:20px;padding:16px 24px;background:rgba(255,255,255,0.12);border-radius:10px;display:flex;gap:40px;flex-wrap:wrap">
      <div><span style="font-size:11px;opacity:0.7">Student Name</span><div style="font-size:16px;font-weight:600">${result.studentName}</div></div>
      <div><span style="font-size:11px;opacity:0.7">Class</span><div style="font-size:16px;font-weight:600">${result.studentClass}</div></div>
      <div><span style="font-size:11px;opacity:0.7">Holland Code</span><div style="font-size:16px;font-weight:600;letter-spacing:2px">${result.hollandCode}</div></div>
      <div><span style="font-size:11px;opacity:0.7">CCI</span><div style="font-size:16px;font-weight:600">${result.cci}</div></div>
    </div>
  </div>

  <!-- COMPOSITE SCORES -->
  <div style="display:flex;gap:24px;margin-bottom:32px;flex-wrap:wrap">
    <div style="flex:1 1 300px;border:1px solid #e2e8f0;border-radius:12px;padding:20px">
      <h3 style="font-size:15px;font-weight:700;color:#1a365d;margin-bottom:16px">Potential Score</h3>
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:100px;height:100px;border-radius:50%;margin:0 auto;background:conic-gradient(#4361ee ${result.potentialScore.total * 3.6}deg,#e2e8f0 0deg);display:flex;align-items:center;justify-content:center">
          <div style="width:76px;height:76px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:28px;font-weight:700;color:#4361ee">${result.potentialScore.total}</span>
            <span style="font-size:9px;color:#64748b">/ 100</span>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px">
        ${scoreCircle(result.potentialScore.personality, 25, '#e53e3e', 'Personality')}
        ${scoreCircle(result.potentialScore.intelligence, 25, '#3182ce', 'Intelligence')}
        ${scoreCircle(result.potentialScore.ability, 30, '#9f7aea', 'Ability')}
        ${scoreCircle(result.potentialScore.academic, 20, '#38a169', 'Academic')}
      </div>
    </div>
    <div style="flex:1 1 300px;border:1px solid #e2e8f0;border-radius:12px;padding:20px">
      <h3 style="font-size:15px;font-weight:700;color:#1a365d;margin-bottom:16px">Preference Score</h3>
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:100px;height:100px;border-radius:50%;margin:0 auto;background:conic-gradient(#059669 ${result.preferenceScore.total * 3.6}deg,#e2e8f0 0deg);display:flex;align-items:center;justify-content:center">
          <div style="width:76px;height:76px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:28px;font-weight:700;color:#059669">${result.preferenceScore.total}</span>
            <span style="font-size:9px;color:#64748b">/ 100</span>
          </div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:8px">
        ${scoreCircle(result.preferenceScore.p1Values, 20, '#8b5cf6', 'Values')}
        ${scoreCircle(result.preferenceScore.p2Aspirations, 20, '#ec4899', 'Aspirations')}
        ${scoreCircle(result.preferenceScore.p3Culture, 30, '#06b6d4', 'Culture')}
        ${scoreCircle(result.preferenceScore.p4Subjects, 30, '#f59e0b', 'Subjects')}
      </div>
    </div>
  </div>

  <!-- ALIGNMENT / CCI / HOLLAND -->
  <div style="display:flex;gap:16px;margin-bottom:32px;flex-wrap:wrap">
    <div style="flex:1 1 200px;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px">Alignment Score</div>
      <div style="font-size:36px;font-weight:700;color:#4361ee">${result.alignmentScore}%</div>
      <div style="font-size:11px;color:#64748b">Profile-Career Consistency</div>
    </div>
    <div style="flex:1 1 200px;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px">Career Clarity Index</div>
      <div style="font-size:36px;font-weight:700;color:${result.cci === 'High' ? '#059669' : result.cci === 'Moderate' ? '#d97706' : '#dc2626'}">${result.cci}</div>
      <div style="font-size:11px;color:#64748b">Aspiration-Suitability Match</div>
    </div>
    <div style="flex:1 1 200px;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px">Holland Code</div>
      <div style="font-size:36px;font-weight:700;color:#1a365d;letter-spacing:4px">${result.hollandCode}</div>
      <div style="font-size:11px;color:#64748b">${result.hollandCode.split('').map((c: string) => riasecDisplayName(c)).join(' - ')}</div>
    </div>
  </div>

  <!-- RIASEC -->
  <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
    <h2 style="font-size:20px;font-weight:700;color:#1a365d">Career Personality (RIASEC)</h2>
    <p style="font-size:13px;color:#64748b;margin-top:4px">Section D — 54 items, Yes/No format</p>
  </div>
  <table><thead><tr style="background:#f8fafc">
    <th style="${thStyle};width:25%">Domain</th><th style="${thStyle};width:12%">Raw</th><th style="${thStyle};width:12%">Norm %</th>
    <th style="${thStyle};width:10%">Stanine</th><th style="${thStyle};width:15%">Level</th><th style="${thStyle};width:26%">Bar</th>
  </tr></thead><tbody>${riasecRows}</tbody></table>
  <div style="height:24px"></div>

  <!-- ABILITIES -->
  <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
    <h2 style="font-size:20px;font-weight:700;color:#1a365d">Abilities</h2>
    <p style="font-size:13px;color:#64748b;margin-top:4px">Section E — 30 items (3 per ability), MCQ/SJT format</p>
  </div>
  <table><thead><tr style="background:#f8fafc">
    <th style="${thStyle};width:25%">Domain</th><th style="${thStyle};width:12%">Raw</th><th style="${thStyle};width:12%">Norm %</th>
    <th style="${thStyle};width:10%">Stanine</th><th style="${thStyle};width:15%">Level</th><th style="${thStyle};width:26%">Bar</th>
  </tr></thead><tbody>${abilityRows}</tbody></table>
  <div style="height:24px"></div>

  <!-- MI -->
  <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
    <h2 style="font-size:20px;font-weight:700;color:#1a365d">Multiple Intelligences</h2>
    <p style="font-size:13px;color:#64748b;margin-top:4px">Section F — 24 items (3 per domain), Likert scale</p>
  </div>
  <table><thead><tr style="background:#f8fafc">
    <th style="${thStyle};width:25%">Domain</th><th style="${thStyle};width:12%">Raw</th><th style="${thStyle};width:12%">Norm %</th>
    <th style="${thStyle};width:10%">Stanine</th><th style="${thStyle};width:15%">Level</th><th style="${thStyle};width:26%">Bar</th>
  </tr></thead><tbody>${miRows}</tbody></table>
  <div style="height:24px"></div>

  <!-- PREFERENCES -->
  <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
    <h2 style="font-size:20px;font-weight:700;color:#1a365d">Student Preferences</h2>
    <p style="font-size:13px;color:#64748b;margin-top:4px">Sections A, B, C — Checklist selections</p>
  </div>
  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:32px">
    <div style="flex:1 1 200px"><h4 style="font-size:13px;font-weight:700;color:#1a365d;margin-bottom:8px">Career Aspirations</h4>${tagsHtml(result.careerAspirations, '#4361ee')}</div>
    <div style="flex:1 1 200px"><h4 style="font-size:13px;font-weight:700;color:#1a365d;margin-bottom:8px">Work Values</h4>${tagsHtml(result.values, '#059669')}</div>
    <div style="flex:1 1 200px"><h4 style="font-size:13px;font-weight:700;color:#1a365d;margin-bottom:8px">Subjects of Interest</h4>${tagsHtml(result.subjectsOfInterest, '#8b5cf6')}</div>
  </div>

  <!-- TOP CAREER MATCHES -->
  <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
    <h2 style="font-size:20px;font-weight:700;color:#1a365d">Top Career Matches (${result.topCareers.length})</h2>
    <p style="font-size:13px;color:#64748b;margin-top:4px">Ranked by suitability — potential match (60%) + values match (40%) + aspiration bonus</p>
  </div>
  ${topCareerCards}

  <!-- ALL CAREERS TABLE -->
  <div style="margin-top:24px">
    <h4 style="font-size:13px;font-weight:700;color:#1a365d;margin-bottom:12px">Complete Career Suitability Ranking</h4>
    <table><thead><tr style="background:#f8fafc">
      <th style="${thStyle};width:5%">#</th><th style="${thStyle}">Career Field</th>
      <th style="${thStyle};width:12%;text-align:center">Suitability</th><th style="${thStyle};width:12%;text-align:center">Potential</th>
      <th style="${thStyle};width:12%;text-align:center">Values</th><th style="${thStyle};width:8%;text-align:center">Stanine</th>
      <th style="${thStyle};width:20%">Bar</th>
    </tr></thead><tbody>${careerRows}</tbody></table>
  </div>

  ${result.flags.length > 0 ? `
  <!-- FLAGS -->
  <div style="margin-top:32px">
    <div style="margin-bottom:20px;border-bottom:3px solid #4361ee;padding-bottom:8px">
      <h2 style="font-size:20px;font-weight:700;color:#1a365d">Psychometric Flags</h2>
      <p style="font-size:13px;color:#64748b;margin-top:4px">Observations & recommendations for counsellor review</p>
    </div>
    ${flagsHtml}
  </div>` : ''}

  <!-- FOOTER -->
  <div style="margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#64748b">
    <div>Navigator 360 v1.0 | Career-9 Psychometric Assessment Platform</div>
    <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════ PREVIEW MODAL ═══════════════════════

interface Navigator360PreviewProps {
  studentId: number;
  assessmentId: number;
  studentName: string;
  onClose: () => void;
}

export const Navigator360Preview: React.FC<Navigator360PreviewProps> = ({
  studentId, assessmentId, studentName, onClose,
}) => {
  const [result, setResult] = useState<Navigator360Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNavigator360Scores(studentId, assessmentId)
      .then((scores) => {
        if (cancelled) return;
        const computed = computeNavigator360(scores);
        setResult(computed);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error || err.message || 'Failed to load data');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId, assessmentId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const html = generateReportHTML(result);
      const blob = await htmlToPdfBlob(html);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (studentName || 'student').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      a.download = `${safeName}_Navigator_360.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [result, studentName]);

  const handlePreviewHtml = useCallback(() => {
    if (!result) return;
    const html = generateReportHTML(result);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }, [result]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        style={{
          width: '90vw', maxWidth: 900, maxHeight: '90vh', background: '#fff',
          borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          padding: '16px 24px', background: BRAND.primary, color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Navigator 360 Report</h3>
            <span style={{ fontSize: 12, opacity: 0.8 }}>{studentName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {result && (
              <>
                <button
                  onClick={handlePreviewHtml}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  Open in Tab
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: '#4361ee', color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1,
                  }}>
                  {downloading ? 'Creating PDF...' : 'Download PDF'}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent', color: '#fff', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              x
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 0, background: BRAND.bg }}>
          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: BRAND.textMuted }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Computing Navigator 360 scores...</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>Analyzing RIASEC, Abilities, MI, and Career Matches</div>
            </div>
          )}
          {error && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.danger, marginBottom: 8 }}>Error</div>
              <div style={{ fontSize: 12, color: BRAND.textMuted }}>{error}</div>
            </div>
          )}
          {result && <ReportBody result={result} />}
        </div>
      </div>
    </div>
  );
};

export default Navigator360Preview;
