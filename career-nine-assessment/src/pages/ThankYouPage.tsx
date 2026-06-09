import React, { useEffect, useState } from 'react';
import { useStudentBranding, brandLogoSrc } from '../hooks/useStudentBranding';
import { useNavigate } from 'react-router-dom';
import { getUpgradeInfo, prepareReport } from '../api-clients/campaignAPI';
import { TierCard, Tier } from '../components/TierCard';
import CounsellingSlotPicker from '../components/CounsellingSlotPicker';
import FeatureUpsellModal, { UpsellFeature } from '../components/FeatureUpsellModal';
import { downloadHtmlAsPdf } from '../utils/htmlToPdf';

type UpgradeInfo = {
    entitlementId: number;
    status: string;
    purchasePath: string;
    alreadyActive: boolean;
    finalReportActive?: boolean;
    // Entitlement-level service flags returned by /campaign/public/upgrade-info
    // (mirror of StudentEntitlement). Used to drive the conditional outcome
    // CTAs and the per-feature "Add <feature>" upsell cards on this page.
    dashboardActive?: boolean;
    counsellingActive?: boolean;
    counsellingSessionsTotal?: number;
    counsellingSessionsUsed?: number;
    accessToken?: string | null;
    campaign: { campaignId: number; name: string; slug: string; brandLogoUrl?: string };
    assessment: { assessmentId: number; assessmentName: string };
    student: { name?: string; email?: string; phone?: string };
    tiers: Tier[];
    activeTier: null | { name: string; includesDashboard: boolean; includesFinalReport?: boolean };
    dashboardUrl: string | null;
    finalReportUrl: string | null;
    careerLibraryUrl: string;
};

type BookedAppointment = {
    appointmentId: number;
    status: string;
    slotDate?: string;
    slotStartTime?: string;
    counsellorName?: string;
    sessionsRemaining?: number;
};

// Compact "Add <feature>" pill rendered above the outcome-tiles row for students
// whose entitlement is missing a feature available on a higher tier. Visual
// language deliberately distinct from the outcome tiles (smaller, pink, pill
// shape) so it reads as an action you can take, not an outcome you have.
const UpsellCard: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        style={{
            background: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)',
            color: '#9D174D',
            border: '1px solid #F9A8D4',
            borderRadius: 999,
            padding: '0.5rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.18)',
        }}
    >
        <span style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#EC4899',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem',
            fontWeight: 700,
            lineHeight: 1,
        }}>+</span>
        {label}
    </button>
);

type ReportState = 'idle' | 'preparing' | 'ready' | 'failed';

const ThankYouPage: React.FC = () => {
    const navigate = useNavigate();

    const branding = useStudentBranding();
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [submittedRating, setSubmittedRating] = useState<number>(0);
    const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
    const [ratingError, setRatingError] = useState<string>('');
    const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null);
    const [upgradeInfoLoaded, setUpgradeInfoLoaded] = useState<boolean>(false);
    const [reportState, setReportState] = useState<ReportState>('idle');
    const [longWait, setLongWait] = useState<boolean>(false);
    // Captured from prepareReport response — the DO Spaces HTML URL + the
    // resolved report type (bet/pager). For "pager" we fetch HTML from this URL
    // and convert client-side. For "bet" we still hand off to the existing
    // server-side PDF endpoint (upgradeInfo.finalReportUrl).
    const [preparedReportUrl, setPreparedReportUrl] = useState<string | null>(null);
    const [preparedReportType, setPreparedReportType] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    // Counselling slot picker open state + post-booking confirmation snapshot.
    // When `bookedAppointment` is set the Counselling CTA flips to a green
    // confirmation tile instead of the "Book" button; the slot picker won't
    // re-open. Stays in component state — a page reload re-reads counselling
    // remaining via /upgrade-info and re-renders the CTA correctly.
    const [isSlotPickerOpen, setIsSlotPickerOpen] = useState<boolean>(false);
    const [bookedAppointment, setBookedAppointment] = useState<BookedAppointment | null>(null);
    // Which per-feature upsell modal is open, if any. Set by the "Add <feature>"
    // cards; cleared on close / choose. Choosing a tier inside the modal reuses
    // the existing handleChoosePlan navigation — same /upgrade route, same
    // /pay-for-report Razorpay path.
    const [upsellFeature, setUpsellFeature] = useState<UpsellFeature | null>(null);
    // Brief initial state that surfaces "Recording your responses…" for the
    // first ~3s after the student lands here, covering the async-persist race
    // window before the report-prepare spinner takes over. Pure UX — does not
    // gate any backend call (the backend already retries via PagerScoreSource).
    const [isRecordingPhase, setIsRecordingPhase] = useState<boolean>(true);
    useEffect(() => {
        const t = window.setTimeout(() => setIsRecordingPhase(false), 3000);
        return () => window.clearTimeout(t);
    }, []);

    // Allow the B2C admin tracker (or a direct test link) to bootstrap the
    // page without a real assessment session by passing the IDs via query
    // params. Falls back to whatever localStorage already has.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eid = params.get('e') || params.get('entitlementId');
        const usid = params.get('userStudentId');
        const aid = params.get('assessmentId');
        if (eid) localStorage.setItem('entitlementId', eid);
        if (usid) localStorage.setItem('userStudentId', usid);
        if (aid) localStorage.setItem('assessmentId', aid);
    }, []);

    useEffect(() => {
        const webgazerVideo = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        if (webgazerVideo && webgazerVideo.srcObject) {
            (webgazerVideo.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
            webgazerVideo.srcObject = null;
        }
        ['webgazerVideoContainer', 'webgazerFaceFeedbackBox', 'webgazerGazeDot', 'webgazerFaceOverlay'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }, []);

    useEffect(() => {
        const entitlementId = localStorage.getItem('entitlementId');
        if (!entitlementId) {
            setUpgradeInfoLoaded(true);
            return;
        }
        getUpgradeInfo(entitlementId)
            .then((res) => setUpgradeInfo(res.data as UpgradeInfo))
            .catch(() => setUpgradeInfo(null))
            .finally(() => setUpgradeInfoLoaded(true));
    }, []);

    // Once upgrade-info is loaded, if the entitlement is already active (the
    // student paid in advance, Path A — or upgraded from Path B), eagerly
    // pre-generate the report so the Download button is instant.
    useEffect(() => {
        if (!upgradeInfo) return;
        if (!upgradeInfo.alreadyActive) return;
        if (!upgradeInfo.finalReportActive) return;
        if (!upgradeInfo.accessToken) return;
        if (reportState !== 'idle') return;

        setReportState('preparing');
        setLongWait(false);
        const longWaitTimer = window.setTimeout(() => setLongWait(true), 8000);

        prepareReport(
            upgradeInfo.entitlementId,
            upgradeInfo.accessToken,
            upgradeInfo.assessment.assessmentId,
        )
            .then((res) => {
                const data: any = res?.data;
                if (data?.reportUrl) setPreparedReportUrl(data.reportUrl);
                if (data?.reportType) setPreparedReportType(data.reportType);
                setReportState('ready');
            })
            .catch(() => setReportState('failed'))
            .finally(() => window.clearTimeout(longWaitTimer));

        return () => window.clearTimeout(longWaitTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [upgradeInfo?.entitlementId, upgradeInfo?.alreadyActive, upgradeInfo?.finalReportActive, upgradeInfo?.accessToken]);

    const handleExploreCareerLibrary = () => {
        window.open('https://library.career-9.com', '_blank');
    };

    const handleGoToDashboard = () => {
        if (upgradeInfo?.dashboardUrl) window.open(upgradeInfo.dashboardUrl, '_blank');
    };

    const handleDownloadReport = async () => {
        // "pager" reports live as HTML on DO Spaces — we fetch + convert in the
        // browser so the user gets a single PDF download without round-tripping
        // through Flying Saucer. "bet" reports keep the existing server-side
        // PDF endpoint (preparedReportType==='bet' OR no captured type).
        if (preparedReportType === 'pager' && preparedReportUrl) {
            try {
                setIsDownloading(true);
                const safeName = (upgradeInfo?.student.name || 'career9')
                    .replace(/[^a-zA-Z0-9]/g, '_')
                    .toLowerCase();
                await downloadHtmlAsPdf(preparedReportUrl, `${safeName}_career9_report.pdf`);
            } catch (err) {
                console.error('Client-side PDF conversion failed', err);
                // Last-resort fallback: open the HTML in a new tab so the user
                // can use the browser's "Save as PDF" feature.
                window.open(preparedReportUrl, '_blank');
            } finally {
                setIsDownloading(false);
            }
            return;
        }
        if (upgradeInfo?.finalReportUrl) window.open(upgradeInfo.finalReportUrl, '_blank');
    };

    const showUpgradeCta =
        !!upgradeInfo &&
        upgradeInfo.status === 'pending' &&
        upgradeInfo.purchasePath === 'B' &&
        upgradeInfo.tiers.length > 0;
    const showActiveButtons = !!upgradeInfo && upgradeInfo.alreadyActive;
    const showDashboardButton = showActiveButtons && !!upgradeInfo?.dashboardUrl;
    // Hold the download button until the prepare call has succeeded — that's
    // the contract that makes "Download Report" instant rather than racing
    // a fresh generation on click.
    const expectsReport = showActiveButtons && !!upgradeInfo?.finalReportActive;
    const showFailedState = expectsReport && reportState === 'failed';
    const showDownloadReportButton =
        showActiveButtons && !!upgradeInfo?.finalReportUrl && reportState === 'ready';

    // Counselling: gated on the entitlement flag AND on having unused sessions
    // remaining. The server gates the slot endpoints the same way, but checking
    // here keeps the CTA off the page when there's nothing actionable behind it.
    const counsellingRemainingFromUpgradeInfo = Math.max(
        0,
        (upgradeInfo?.counsellingSessionsTotal ?? 0) - (upgradeInfo?.counsellingSessionsUsed ?? 0),
    );
    // After a fresh booking, the upgrade-info on this page hasn't been re-fetched,
    // so subtract the just-booked session locally for the remaining count.
    const counsellingRemaining = bookedAppointment
        ? Math.max(0, counsellingRemainingFromUpgradeInfo - 1)
        : counsellingRemainingFromUpgradeInfo;
    const showCounsellingButton =
        showActiveButtons &&
        !!upgradeInfo?.counsellingActive &&
        !!upgradeInfo?.accessToken &&
        counsellingRemainingFromUpgradeInfo > 0;

    // Per-feature upsell gating. Only show "Add <feature>" cards to a student
    // who has already activated SOMETHING (status='active' / alreadyActive),
    // i.e. paid for a partial tier, so we don't double up with the broader
    // showUpgradeCta block that paints the full Try-First landing for pending
    // students. Filter the campaign's tier list to the tiers that ACTUALLY
    // include the missing feature — a "Buy Counselling" CTA shouldn't open a
    // tier picker offering tiers without counselling.
    const tiersWithFeature = (key: 'includesFinalReport' | 'includesDashboard' | 'includesCounselling') =>
        (upgradeInfo?.tiers ?? []).filter((t) => (t as any)[key] === true);
    const missingReport =
        showActiveButtons && upgradeInfo?.finalReportActive === false;
    const missingDashboard =
        showActiveButtons && upgradeInfo?.dashboardActive === false;
    const missingCounselling =
        showActiveButtons && upgradeInfo?.counsellingActive === false;
    const reportUpsellTiers = missingReport ? tiersWithFeature('includesFinalReport') : [];
    const dashboardUpsellTiers = missingDashboard ? tiersWithFeature('includesDashboard') : [];
    const counsellingUpsellTiers = missingCounselling ? tiersWithFeature('includesCounselling') : [];
    const showReportUpsell = reportUpsellTiers.length > 0;
    const showDashboardUpsell = dashboardUpsellTiers.length > 0;
    const showCounsellingUpsell = counsellingUpsellTiers.length > 0;
    const showAnyUpsell = showReportUpsell || showDashboardUpsell || showCounsellingUpsell;

    const upsellTiersFor: Record<UpsellFeature, Tier[]> = {
        report: reportUpsellTiers,
        dashboard: dashboardUpsellTiers,
        counselling: counsellingUpsellTiers,
    };

    // Unified loading: cover both the upgrade-info fetch (so tiers/offers
    // don't pop in silently) AND the eager prepareReport call for paid users,
    // so the student sees one continuous "preparing your report" state until
    // we either have a ready download or know it failed.
    const isLoadingContent =
        !upgradeInfoLoaded || (expectsReport && reportState === 'preparing');

    const handleChoosePlan = (campaignAssessmentTierId?: number) => {
        if (!upgradeInfo) return;
        const slug = upgradeInfo.campaign.slug;
        const aid = upgradeInfo.assessment.assessmentId;
        const eid = upgradeInfo.entitlementId;
        const suffix = campaignAssessmentTierId ? `?tier=${campaignAssessmentTierId}` : '';
        navigate(`/c/${slug}/${aid}/upgrade/${eid}${suffix}`);
    };

    const handleOpenSlotPicker = () => setIsSlotPickerOpen(true);
    const handleSlotPickerClose = () => setIsSlotPickerOpen(false);
    const handleSlotBooked = (result: BookedAppointment) => {
        // Snapshot the booking so the Counselling tile flips to its confirmation
        // state without an extra round-trip. counsellingRemaining decreases by one
        // locally; the page does NOT refetch upgrade-info because reloading
        // would also reset reportState back to 'preparing' and disrupt the
        // download-ready state for paid students.
        setBookedAppointment(result);
        setIsSlotPickerOpen(false);
    };

    const submitRating = async (rating: number) => {
        if (submittedRating > 0 || isSubmittingRating) return;

        const userStudentId = localStorage.getItem('userStudentId');
        const assessmentId = localStorage.getItem('assessmentId');

        if (!userStudentId || !assessmentId) {
            setRatingError('Unable to record rating — session info missing.');
            return;
        }

        setIsSubmittingRating(true);
        setRatingError('');

        try {
            const csrfMatch = document.cookie.match(/(?:^|;\s*)cn_csrf=([^;]*)/);
            const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/assessment-answer/feedback-rating`,
                {
                    method: 'PUT',
                    credentials: 'include', // Phase 19: send cn_at_asmnt cookie on rating submit
                    headers,
                    body: JSON.stringify({
                        userStudentId: parseInt(userStudentId, 10),
                        assessmentId: parseInt(assessmentId, 10),
                        rating,
                    }),
                },
            );

            if (!res.ok) {
                throw new Error(`Request failed: ${res.status}`);
            }

            setSubmittedRating(rating);
        } catch (err) {
            setRatingError('Could not save your rating. Please try again.');
        } finally {
            setIsSubmittingRating(false);
        }
    };

    const displayRating = submittedRating || hoveredRating;

    return (
        <>
            <div className="assessment-bg" style={{ flexDirection: 'column', position: 'relative', padding: '1.5rem' }}>
                {/* Decorative floating elements - hidden on mobile via CSS */}
                <div className="thank-you-decoration" style={{ top: '10%', left: '5%', width: '120px', height: '120px', animation: 'float 6s ease-in-out infinite' }} />
                <div className="thank-you-decoration" style={{ bottom: '15%', right: '8%', width: '80px', height: '80px', background: 'rgba(255,255,255,0.08)', animation: 'float 8s ease-in-out infinite reverse' }} />

                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-12 col-sm-10 col-md-8 col-lg-7 col-xl-6">
                            <div className="thank-you-card" style={{ animation: 'fadeIn 0.8s ease-out' }}>
                                {/* Success checkmark icon */}
                                <div
                                    className="success-icon mx-auto mb-3"
                                    style={{
                                        width: '75px',
                                        height: '75px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                                        animation: 'scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    }}
                                >
                                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>

                                <img
                                    src={brandLogoSrc(branding)}
                                    alt={branding.whitelabel ? (branding.schoolName || 'School') + ' logo' : 'Career-9 Logo'}
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                        objectFit: 'contain',
                                        borderRadius: '14px',
                                        margin: '0 auto 1.25rem auto',
                                        display: 'block',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                                    }}
                                />
                                {branding.whitelabel && (
                                    <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#94a3b8', marginTop: '-0.75rem', marginBottom: '1rem' }}>
                                        Powered by Career-9
                                    </p>
                                )}

                                <h1
                                    style={{
                                        background: 'linear-gradient(135deg, #5DD68D 0%, #3FB876 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                        fontSize: '2.25rem',
                                        marginBottom: '0.75rem',
                                        fontWeight: '800',
                                        letterSpacing: '-0.5px',
                                    }}
                                >
                                    Thank You!
                                </h1>

                                <p style={{ color: '#4a5568', fontSize: '1.05rem', marginBottom: '0.75rem', lineHeight: '1.7', fontWeight: '500' }}>
                                    You have successfully completed your assessment.
                                </p>

                                <p style={{ color: '#718096', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                                    Your responses have been recorded securely. <br className="d-none d-sm-inline" />
                                    Now explore your personalized insights and career possibilities!
                                </p>

                                {/* 5-star feedback rating */}
                                <div
                                    style={{
                                        background: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '14px',
                                        padding: '1rem 1.25rem',
                                        marginBottom: '1.5rem',
                                    }}
                                >
                                    <p
                                        style={{
                                            color: '#2d3748',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            margin: '0 0 0.5rem 0',
                                        }}
                                    >
                                        How did you find the assessment?
                                    </p>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            marginBottom: submittedRating || ratingError ? '0.5rem' : 0,
                                        }}
                                        onMouseLeave={() => setHoveredRating(0)}
                                    >
                                        {[1, 2, 3, 4, 5].map((star) => {
                                            const isActive = star <= displayRating;
                                            const isLocked = submittedRating > 0 || isSubmittingRating;
                                            return (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                                                    onMouseEnter={() => !isLocked && setHoveredRating(star)}
                                                    onClick={() => submitRating(star)}
                                                    disabled={isLocked}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '4px',
                                                        cursor: isLocked ? 'default' : 'pointer',
                                                        transition: 'transform 0.15s ease',
                                                        transform: isActive && !submittedRating ? 'scale(1.1)' : 'scale(1)',
                                                    }}
                                                >
                                                    <svg
                                                        width="32"
                                                        height="32"
                                                        viewBox="0 0 24 24"
                                                        fill={isActive ? '#f59e0b' : 'none'}
                                                        stroke={isActive ? '#f59e0b' : '#cbd5e0'}
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {submittedRating > 0 && (
                                        <p style={{ color: '#059669', fontSize: '0.85rem', margin: 0, fontWeight: 500 }}>
                                            Thanks for your feedback!
                                        </p>
                                    )}
                                    {ratingError && (
                                        <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>
                                            {ratingError}
                                        </p>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, rgba(93, 214, 141, 0.3), transparent)',
                                    margin: '0 auto 1.5rem auto',
                                    width: '80%',
                                }} />

                                {/* Unified loading state — shown until upgrade-info has
                                    loaded AND (if applicable) the eager report-prepare
                                    call has either succeeded or failed. Keeps tiers,
                                    CTAs and the report status from popping in piecemeal. */}
                                {isLoadingContent && (
                                    <div style={ts.preparingCard}>
                                        <div className="spinner-border text-warning" role="status" style={{ width: '2.25rem', height: '2.25rem' }}>
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <h3 style={ts.preparingTitle}>
                                            {isRecordingPhase
                                                ? 'Recording your responses…'
                                                : expectsReport
                                                    ? "Hold on — we're preparing your detailed report"
                                                    : 'Loading your results…'}
                                        </h3>
                                        <p style={ts.preparingSub}>
                                            {isRecordingPhase
                                                ? "Your submission is being saved. We'll have your report ready in a moment."
                                                : longWait
                                                    ? 'Almost done… this usually takes 10–20 seconds.'
                                                    : 'This usually takes a few seconds.'}
                                        </p>
                                    </div>
                                )}

                                {/* Try-First landing — students who haven't paid yet */}
                                {!isLoadingContent && showUpgradeCta && upgradeInfo && (
                                    <TryFirstLanding
                                        upgradeInfo={upgradeInfo}
                                        onChoosePlan={handleChoosePlan}
                                    />
                                )}

                                {/* Failure state — generation threw, error already recorded */}
                                {!isLoadingContent && showFailedState && (
                                    <div style={ts.failedCard}>
                                        <div style={ts.failedOrb}>!</div>
                                        <h3 style={ts.failedTitle}>
                                            Your report will be generated and sent to you
                                        </h3>
                                        <p style={ts.failedSub}>
                                            We hit a hiccup preparing your report. It will be emailed to{' '}
                                            <strong>{upgradeInfo?.student.email ?? 'you'}</strong> within 24 hours.
                                            Our team has been notified — no action needed from your side.
                                        </p>
                                    </div>
                                )}

                                {/* Active state — student paid AND report is ready */}
                                {!isLoadingContent && showActiveButtons && reportState === 'ready' && (
                                    <p style={{ color: '#059669', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                                        ✓ Your report is ready. We've also sent it to your email.
                                    </p>
                                )}

                                {/* Per-feature upsell strip — surfaces "Add Report", "Add Dashboard",
                                    "Add Counselling" cards for students whose current tier doesn't
                                    include each feature. Sits ABOVE the outcome-tiles row so the
                                    upgrade CTA is the first thing a partial-tier student sees. Each
                                    card opens FeatureUpsellModal pre-filtered to tiers that include
                                    the missing feature; choosing a tier reuses the existing
                                    /upgrade route + /pay-for-report Razorpay flow. */}
                                {!isLoadingContent && showAnyUpsell && (
                                    <div
                                        className="d-flex justify-content-center flex-wrap"
                                        style={{ gap: '10px', marginBottom: '1.25rem' }}
                                    >
                                        {showReportUpsell && (
                                            <UpsellCard
                                                label="Add Detailed Report"
                                                onClick={() => setUpsellFeature('report')}
                                            />
                                        )}
                                        {showDashboardUpsell && (
                                            <UpsellCard
                                                label="Add Dashboard Access"
                                                onClick={() => setUpsellFeature('dashboard')}
                                            />
                                        )}
                                        {showCounsellingUpsell && (
                                            <UpsellCard
                                                label="Add Counselling Session"
                                                onClick={() => setUpsellFeature('counselling')}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* CTA tiles row — hide during loading so the page doesn't
                                    jump as buttons fade in / out. */}
                                {!isLoadingContent && (
                                <div className="d-flex justify-content-center flex-wrap" style={{ gap: '14px' }}>
                                    {/* Download Report — only when active and final report included */}
                                    {showDownloadReportButton && (
                                        <div
                                            onClick={handleDownloadReport}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(245, 158, 11, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(245, 158, 11, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(245, 158, 11, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.22)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Download Report
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                Open your detailed Career-9 report
                                            </p>
                                        </div>
                                    )}

                                    {/* Go to Dashboard — only when active and dashboard included */}
                                    {showDashboardButton && (
                                        <div
                                            onClick={handleGoToDashboard}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(59, 130, 246, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(59, 130, 246, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(59, 130, 246, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="3" width="7" height="9" />
                                                    <rect x="14" y="3" width="7" height="5" />
                                                    <rect x="14" y="12" width="7" height="9" />
                                                    <rect x="3" y="16" width="7" height="5" />
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Go to Dashboard
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                See your personalized insights & report
                                            </p>
                                        </div>
                                    )}

                                    {/* Book Counselling — only when active, counselling included, and seats remain */}
                                    {showCounsellingButton && !bookedAppointment && (
                                        <div
                                            onClick={handleOpenSlotPicker}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(139, 92, 246, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(139, 92, 246, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(139, 92, 246, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.22)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Book Counselling
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                {counsellingRemainingFromUpgradeInfo} session{counsellingRemainingFromUpgradeInfo === 1 ? '' : 's'} ready to book
                                            </p>
                                        </div>
                                    )}

                                    {/* Counselling booked confirmation */}
                                    {bookedAppointment && (
                                        <div
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #A7F3D0 0%, #10B981 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                boxShadow: '0 10px 35px rgba(16, 185, 129, 0.4)',
                                                width: '100%',
                                                maxWidth: '280px',
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.22)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Counselling Booked
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                {bookedAppointment.slotDate && bookedAppointment.slotStartTime
                                                    ? `${bookedAppointment.slotDate} · ${bookedAppointment.slotStartTime}`
                                                    : 'Your counsellor will reach out shortly'}
                                                {counsellingRemaining > 0 && (
                                                    <><br/><span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{counsellingRemaining} more available</span></>
                                                )}
                                            </p>
                                        </div>
                                    )}

                                    {/* Career Library — always shown */}
                                    <div
                                        onClick={handleExploreCareerLibrary}
                                        className="text-center"
                                        style={{
                                            background: 'linear-gradient(135deg, #86EFAC 0%, #34D399 100%)',
                                            borderRadius: '16px',
                                            padding: '1.25rem 1.5rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 10px 35px rgba(52, 211, 153, 0.4)',
                                            width: '100%',
                                            maxWidth: '280px',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                            e.currentTarget.style.boxShadow = '0 15px 45px rgba(52, 211, 153, 0.5)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                            e.currentTarget.style.boxShadow = '0 10px 35px rgba(52, 211, 153, 0.4)';
                                        }}
                                    >
                                        <div style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '10px',
                                            background: 'rgba(255,255,255,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 0.75rem auto',
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                                <path d="M8 7h8"></path>
                                                <path d="M8 11h6"></path>
                                            </svg>
                                        </div>
                                        <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.4rem' }}>
                                            {showActiveButtons ? 'Go to Career Library' : 'Explore Career Library'}
                                        </h3>
                                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                            Explore 200+ career options from 44+ career categories
                                        </p>
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <style>
                    {`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(30px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes scaleIn {
                            from { transform: scale(0); opacity: 0; }
                            to { transform: scale(1); opacity: 1; }
                        }
                        @keyframes float {
                            0%, 100% { transform: translateY(0px); }
                            50% { transform: translateY(-20px); }
                        }
                    `}
                </style>
            </div>

            {/* Counselling slot picker — modal overlay. Rendered at the fragment
                level so its fixed-position backdrop covers the full viewport
                regardless of the layered backgrounds the page draws. Mounted
                only while open so its initial slot-list fetch fires on each
                open, not on every render. */}
            {isSlotPickerOpen && upgradeInfo?.accessToken && (
                <CounsellingSlotPicker
                    accessToken={upgradeInfo.accessToken}
                    entitlementId={upgradeInfo.entitlementId}
                    sessionsRemaining={counsellingRemainingFromUpgradeInfo}
                    onClose={handleSlotPickerClose}
                    onBooked={handleSlotBooked}
                />
            )}

            {/* Per-feature tier-picker modal. Pre-filtered tier list comes from
                upsellTiersFor[feature]; choosing one navigates to the same
                /c/{slug}/{aid}/upgrade/{eid}?tier=… route the existing CTA uses,
                which hands off to /campaign/public/pay-for-report. No extra
                backend work. */}
            {upsellFeature && upsellTiersFor[upsellFeature].length > 0 && (
                <FeatureUpsellModal
                    feature={upsellFeature}
                    tiers={upsellTiersFor[upsellFeature]}
                    onClose={() => setUpsellFeature(null)}
                    onChoose={(tierId) => {
                        setUpsellFeature(null);
                        handleChoosePlan(tierId);
                    }}
                />
            )}
        </>
    );
};

type TryFirstLandingProps = {
    upgradeInfo: UpgradeInfo;
    onChoosePlan: (campaignAssessmentTierId?: number) => void;
};

const TryFirstLanding: React.FC<TryFirstLandingProps> = ({ upgradeInfo, onChoosePlan }) => {
    const defaultTier =
        upgradeInfo.tiers.find((t) => t.isDefault) ?? upgradeInfo.tiers[0];

    const valueBullets: string[] = [];
    if (defaultTier?.includesFinalReport) valueBullets.push('Detailed career-readiness report');
    if (defaultTier?.includesDashboard) valueBullets.push('Personalised dashboard with insights');
    if (defaultTier?.includesCounselling && defaultTier.counsellingSessionCount) {
        valueBullets.push(
            `${defaultTier.counsellingSessionCount}× 1-on-1 counselling session${defaultTier.counsellingSessionCount > 1 ? 's' : ''}`,
        );
    }
    if (defaultTier?.includesLms) valueBullets.push('Access to the Career-9 learning library');

    return (
        <div style={ts.landingWrap}>
            <div style={ts.landingHero}>
                <span style={ts.landingPill}>Unlock your results</span>
                <h2 style={ts.landingTitle}>
                    {upgradeInfo.student.name ? `${upgradeInfo.student.name}, ` : ''}
                    you've completed {upgradeInfo.assessment.assessmentName}.
                </h2>
                <p style={ts.landingSubtitle}>
                    Choose the plan that's right for you and get your detailed report,
                    career roadmap, and dashboard access.
                </p>
            </div>

            {valueBullets.length > 0 && (
                <ul style={ts.valueList}>
                    {valueBullets.map((b) => (
                        <li key={b} style={ts.valueItem}>
                            <span style={ts.valueTick}>✓</span> {b}
                        </li>
                    ))}
                </ul>
            )}

            <div style={ts.tierGrid}>
                {upgradeInfo.tiers.map((t) => (
                    <TierCard
                        key={t.campaignAssessmentTierId}
                        tier={t}
                        selected={t.isDefault}
                        onSelect={() => onChoosePlan(t.campaignAssessmentTierId)}
                    />
                ))}
            </div>

            <div style={ts.ctaRow}>
                <button
                    type="button"
                    onClick={() => onChoosePlan(defaultTier?.campaignAssessmentTierId)}
                    style={ts.ctaPrimary}
                >
                    Choose this plan →
                </button>
                <a
                    href="https://library.career-9.com"
                    target="_blank"
                    rel="noreferrer"
                    style={ts.ctaSecondary}
                >
                    Explore the career library
                </a>
            </div>

            <div style={ts.trustFooter}>
                <span style={ts.trustItem}>🔒 Secure checkout</span>
                <span style={ts.trustDot} />
                <span style={ts.trustItem}>📩 Report emailed within minutes</span>
                <span style={ts.trustDot} />
                <span style={ts.trustItem}>🎓 Trusted by Career-9 students</span>
            </div>
        </div>
    );
};

const ts: Record<string, React.CSSProperties> = {
    preparingCard: {
        background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
        border: '1px solid #FDE68A',
        borderRadius: 18,
        padding: '1.5rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
    },
    preparingTitle: {
        color: '#92400E',
        fontWeight: 700,
        fontSize: '1.05rem',
        margin: '4px 0 0',
    },
    preparingSub: {
        color: '#a16207',
        fontSize: '0.88rem',
        margin: 0,
        textAlign: 'center',
    },
    failedCard: {
        background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7F7 100%)',
        border: '1px solid #FECACA',
        borderRadius: 18,
        padding: '1.5rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    failedOrb: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
        color: '#dc2626',
        fontWeight: 800,
        fontSize: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    failedTitle: {
        color: '#991B1B',
        fontWeight: 700,
        fontSize: '1.05rem',
        margin: '4px 0 6px',
        textAlign: 'center',
    },
    failedSub: {
        color: '#7f1d1d',
        fontSize: '0.88rem',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.55,
    },
    landingWrap: {
        marginBottom: '1.75rem',
        textAlign: 'left',
    },
    landingHero: {
        textAlign: 'center',
        marginBottom: '1rem',
    },
    landingPill: {
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#0f766e',
        background: '#ccfbf1',
        padding: '4px 10px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
    },
    landingTitle: {
        fontSize: '1.35rem',
        fontWeight: 800,
        color: '#0f172a',
        margin: '0 0 6px',
        lineHeight: 1.3,
    },
    landingSubtitle: {
        fontSize: '0.92rem',
        color: '#475569',
        margin: 0,
        lineHeight: 1.55,
    },
    valueList: {
        listStyle: 'none',
        padding: '12px 16px',
        margin: '0 auto 1rem',
        maxWidth: 480,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
    },
    valueItem: {
        fontSize: '0.85rem',
        color: '#0f172a',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    valueTick: {
        color: '#10b981',
        fontWeight: 800,
    },
    tierGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: '1rem',
    },
    ctaRow: {
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: '1rem',
    },
    ctaPrimary: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: 12,
        padding: '12px 20px',
        fontWeight: 700,
        fontSize: '0.95rem',
        cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)',
    },
    ctaSecondary: {
        background: 'transparent',
        color: '#0f766e',
        border: '1.5px solid #0f766e',
        borderRadius: 12,
        padding: '10px 18px',
        fontWeight: 600,
        fontSize: '0.9rem',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
    },
    trustFooter: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        fontSize: '0.78rem',
        color: '#64748b',
        padding: '8px 0',
    },
    trustItem: { whiteSpace: 'nowrap' },
    trustDot: {
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: '#cbd5e0',
    },
};

export default ThankYouPage;
