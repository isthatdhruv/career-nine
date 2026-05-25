// ═══════════════════════════════════════════════════════════════════════════
// Four-Pager Report — Preview & Download Modal
// Mirrors Navigator360Preview: fetch scores, compute, fill HTML template,
// show in iframe, and expose a Download-PDF button via htmlToPdfBlob.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { buildFourPagerHtml } from './FourPagerAPI';
import { FourPagerVariant, StudentMeta } from './FourPagerTypes';
import { htmlToPdfBlob } from '../../ReportGeneration/utils/htmlToPdf';

interface Props {
  studentId: number;
  assessmentId: number;
  studentName: string;
  studentClass?: string;
  age?: string | number;
  schoolName?: string;
  schoolCity?: string;
  reportUrl?: string;
  onClose: () => void;
}

const BRAND = {
  primary: '#2D4A3E',
  accent: '#4361ee',
  bg: '#FBF9FD',
  text: '#1a202c',
  muted: '#64748b',
  danger: '#dc2626',
};

const VARIANT_LABEL: Record<FourPagerVariant, string> = {
  insight: 'Insight Navigator',
  subject: 'Subject Navigator',
  career: 'Career Navigator',
};

export const FourPagerPreview: React.FC<Props> = ({
  studentId, assessmentId, studentName, studentClass, age, schoolName, schoolCity, reportUrl, onClose,
}) => {
  const [html, setHtml] = useState<string | null>(null);
  const [variant, setVariant] = useState<FourPagerVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const meta: StudentMeta = { studentName, studentClass: studentClass || '', age, schoolName, schoolCity, reportUrl };
    setLoading(true);
    setError(null);
    buildFourPagerHtml(studentId, assessmentId, meta)
      .then(({ html: filled, variant: v }) => {
        if (cancelled) return;
        setHtml(filled);
        setVariant(v);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to build 4-pager report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, assessmentId, studentName, studentClass, age, schoolName, schoolCity, reportUrl]);

  useEffect(() => {
    if (!html || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  const handleDownloadPdf = useCallback(async () => {
    if (!html) return;
    try {
      setDownloading(true);
      const pdfBlob = await htmlToPdfBlob(html);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      const safeName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
      a.href = url;
      a.download = `${safeName}_4Pager_${variant || 'Navigator'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [html, studentName, variant]);

  const handleOpenTab = useCallback(() => {
    if (!html) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }, [html]);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw', maxWidth: 900, maxHeight: '92vh', background: '#fff',
          borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 24px', background: BRAND.primary, color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {variant ? VARIANT_LABEL[variant] : '4-Pager Report'}
            </h3>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{studentName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {html && (
              <>
                <button
                  onClick={handleOpenTab}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Open in Tab
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    background: BRAND.accent, color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1,
                  }}
                >
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
              }}
            >
              x
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 0, background: BRAND.bg }}>
          {loading && (
            <div style={{ padding: 60, textAlign: 'center', color: BRAND.muted }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Building your 4-pager report…</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                Computing Navigator 360 scores and rendering the grade-specific template.
              </div>
            </div>
          )}
          {error && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: BRAND.danger, marginBottom: 8 }}>Error</div>
              <div style={{ fontSize: 12, color: BRAND.muted }}>{error}</div>
            </div>
          )}
          {html && (
            <iframe
              ref={iframeRef}
              title="Four-Pager Preview"
              style={{ width: '100%', height: '80vh', border: 'none', background: '#fff' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
