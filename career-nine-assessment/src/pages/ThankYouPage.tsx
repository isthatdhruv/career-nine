import React, { useEffect, useRef, useState } from 'react';
import { useStudentBranding, brandLogoSrc } from '../hooks/useStudentBranding';
import { useNavigate } from 'react-router-dom';
import { forwardCounsellingRequest, getStudentCounselling, getUpgradeInfo, prepareReport } from '../api-clients/campaignAPI';
import { getCounsellingOptionsByStudent } from '../api-clients/assessmentMappingAPI';
import { TierCard, Tier } from '../components/TierCard';
import CounsellingSlotPicker from '../components/CounsellingSlotPicker';
import MappingCounsellingSection from '../components/MappingCounsellingSection';
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

// Counselling resolved for a SCHOOL student (who has no entitlementId on this
// page — they arrived via a fresh login). Resolved by userStudentId + assessmentId
// via /campaign/public/student-counselling. Drives the same tile + slot picker as
// the B2C path; the two are mutually exclusive (this is only fetched when there is
// no B2C upgradeInfo).
type SchoolCounselling = {
    entitlementId: number;
    accessToken: string;
    sessionsRemaining: number;
    // True when a counsellor is assigned to the assessment — counselling is offered
    // as an optional add-on regardless of the tier's counselling toggle / session count.
    offered: boolean;
    studentName?: string;
    studentEmail?: string;
    studentPhone?: string;
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
    // Retention nudge shown when the student CANCELS the slot picker (standalone — the
    // picker is closed first, so it's never stacked on top of it). "Pick my counselling
    // time" reopens the picker; "No thanks" dismisses it and leaves the Book-counselling
    // card on the page to open whenever they're ready.
    const [showCounsellingReminder, setShowCounsellingReminder] = useState<boolean>(false);
    // Loss-framed confirm when the student tries to abandon the slot picker, and the
    // celebratory "you made a great decision" modal shown right after a booking.
    const [showBookedCelebration, setShowBookedCelebration] = useState<boolean>(false);
    // Counselling for a school student (resolved by userStudentId when there is no
    // B2C entitlementId on this page). Null until resolved / when not applicable.
    const [schoolCounselling, setSchoolCounselling] = useState<SchoolCounselling | null>(null);
    // True when the B2B mapping counselling component (MappingCounsellingSection)
    // owns the booking UI for this student — in which case this page suppresses its
    // OWN counselling CTAs/auto-open to avoid a duplicate booking card.
    const [hasMappingCounselling, setHasMappingCounselling] = useState<boolean>(false);
    // Set when the assessment includes counselling but NO counsellor is mapped yet:
    // we forward the request to Career-9 and show a "request received" notice instead
    // of a bookable slot picker. Null otherwise.
    const [pendingCounselling, setPendingCounselling] = useState<{ supportEmail: string } | null>(null);
    // Ensures the slot picker auto-opens at most once per page mount (so the
    // student isn't trapped re-opening it after they deliberately close it).
    const autoOpenedPickerRef = useRef<boolean>(false);
    // Forwards the counselling request at most once per mount (the POST is also
    // idempotent server-side, so this just avoids a redundant call/email).
    const counsellingForwardedRef = useRef<boolean>(false);
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

    // School-student counselling: only when there's no B2C entitlement on this page.
    // School students log in fresh (no entitlementId) but localStorage carries
    // userStudentId + assessmentId, so we resolve their counselling by those.
    useEffect(() => {
        if (!upgradeInfoLoaded || upgradeInfo) return;
        const userStudentId = localStorage.getItem('userStudentId');
        const assessmentId = localStorage.getItem('assessmentId');
        if (!userStudentId || !assessmentId) return;
        // First resolve whether the B2B mapping counselling component owns the booking
        // UI for this student. If so, this page still shows the "booked" confirmation
        // (single source of truth) but suppresses its OWN booking CTA/auto-open so the
        // student doesn't see two booking cards.
        getCounsellingOptionsByStudent(userStudentId, assessmentId)
            .then((res) => res.data)
            .catch(() => null)
            .then((mo: any) => {
                // mappingExists: the B2B mapping component (MappingCounsellingSection) is
                // present for this student, so it owns the counselling display — including
                // its own "your session is booked" confirmation. Mirrors its render gate
                // (it renders whenever its options object is non-null).
                const mappingExists = !!mo;
                const mappingActionable = !!mo && !!mo.entitlementId &&
                    (mo.canBookNow || mo.payPerSlot ||
                        (mo.needsTierSelection && Array.isArray(mo.tiers) && mo.tiers.length > 0));
                if (mappingActionable) setHasMappingCounselling(true);
                return getStudentCounselling(userStudentId, assessmentId)
                    .then((res) => ({ d: (res?.data as any) || {}, mappingActionable, mappingExists }));
            })
            .then(({ d, mappingActionable, mappingExists }) => {
                // Already booked for this assessment? Record it and do NOT offer/auto-open
                // booking again.
                if (d.alreadyBooked) {
                    // When the mapping component is present it shows its OWN "your session
                    // is booked" confirmation, so suppress this page's duplicate
                    // "Counselling Booked" tile — keep only the single booked card.
                    if (mappingExists) setHasMappingCounselling(true);
                    setBookedAppointment({
                        appointmentId: d.bookedAppointmentId ?? 0,
                        status: d.bookedStatus ?? 'CONFIRMED',
                        slotDate: d.bookedSlotDate,
                        slotStartTime: d.bookedSlotStartTime,
                        counsellorName: d.bookedCounsellorName,
                    });
                    return;
                }
                // The mapping component owns booking — don't render this page's own CTA.
                if (mappingActionable) return;
                // Show the optional booking whenever counselling is OFFERED (a counsellor
                // is assigned to the assessment) and we have a token to book with — not
                // gated on the tier's counselling toggle or session count.
                if (d.counsellingOffered && d.accessToken) {
                    const total = d.counsellingSessionsTotal ?? 0;
                    const used = d.counsellingSessionsUsed ?? 0;
                    setSchoolCounselling({
                        entitlementId: d.entitlementId,
                        accessToken: d.accessToken,
                        sessionsRemaining: Math.max(0, total - used),
                        offered: true,
                        studentName: d.studentName,
                        studentEmail: d.studentEmail,
                        studentPhone: d.studentPhone,
                    });
                } else if (d.counsellingPendingAssignment) {
                    // Counselling is part of the package but no counsellor is mapped yet.
                    // Forward the request to Career-9 (records it + emails the team) and
                    // show a reassurance notice instead of a slot picker.
                    setPendingCounselling({ supportEmail: d.supportEmail || 'support@career-9.net' });
                    if (!d.counsellingRequestForwarded && !counsellingForwardedRef.current) {
                        counsellingForwardedRef.current = true;
                        forwardCounsellingRequest(userStudentId, assessmentId).catch(() => {});
                    }
                }
            })
            .catch(() => {});
    }, [upgradeInfoLoaded, upgradeInfo]);

    // Best-flow: when the student has active counselling with sessions still to
    // book (paid-first Path A, or returning from payment on Path B), open the
    // session picker automatically so choosing a time is a guided step rather
    // than a button they might miss. Fires once per mount and is fully skippable
    // — closing it leaves them on the thank-you page to book later.
    useEffect(() => {
        if (!upgradeInfoLoaded || !upgradeInfo || autoOpenedPickerRef.current) return;
        const remaining =
            (upgradeInfo.counsellingSessionsTotal ?? 0) - (upgradeInfo.counsellingSessionsUsed ?? 0);
        const canBook = !!upgradeInfo.counsellingActive && !!upgradeInfo.accessToken && remaining > 0;
        if (canBook && !bookedAppointment) {
            autoOpenedPickerRef.current = true;
            setIsSlotPickerOpen(true);
        }
    }, [upgradeInfoLoaded, upgradeInfo, bookedAppointment]);

    // As soon as counselling is offered for the assessment (a counsellor is assigned),
    // auto-open the slot picker so the student immediately sees the assigned counsellor's
    // slots. It stays opt-in — picking a slot is their choice; closing it leaves them on
    // the thank-you page with the "Want career counselling?" card to re-open later.
    useEffect(() => {
        if (!schoolCounselling || autoOpenedPickerRef.current) return;
        if (schoolCounselling.offered && !bookedAppointment) {
            autoOpenedPickerRef.current = true;
            setIsSlotPickerOpen(true);
        }
    }, [schoolCounselling, bookedAppointment]);

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
    // Cancelling the picker surfaces the retention reminder as a STANDALONE modal —
    // the picker is closed first, so nothing is stacked. From the reminder, "Pick my
    // counselling time" reopens the picker; "No thanks" leaves the Book-counselling
    // card on the page. Skipped once a booking exists.
    const handleSlotPickerClose = () => {
        setIsSlotPickerOpen(false);
        if (!bookedAppointment) setShowCounsellingReminder(true);
    };
    const handleSlotBooked = (result: BookedAppointment) => {
        // Snapshot the booking so the Counselling tile flips to its confirmation
        // state without an extra round-trip. counsellingRemaining decreases by one
        // locally; the page does NOT refetch upgrade-info because reloading
        // would also reset reportState back to 'preparing' and disrupt the
        // download-ready state for paid students.
        setBookedAppointment(result);
        setIsSlotPickerOpen(false);
        setShowBookedCelebration(true);   // celebratory "great decision" modal
    };

    // "Tue, 17 Jun · 3:00 PM" from slotDate (yyyy-MM-dd) + slotStartTime (HH:mm:ss).
    const formatApptWhen = (date?: string, time?: string): string => {
        if (!date || !time) return '';
        try {
            const d = new Date(`${date}T${time}`);
            const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
            const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            return `${day} · ${t}`;
        } catch {
            return `${date} · ${time}`;
        }
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

                                {/* B2B assessment-mapping: post-assessment counselling tier
                                    selection. Self-gating — renders only when the mapping
                                    student must pick a counselling-bearing tier (otherwise
                                    the existing counselling flow books directly). */}
                                {!isLoadingContent && <MappingCounsellingSection />}

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
                                        <div style={ts.failedOrb}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                                            </svg>
                                        </div>
                                        <h3 style={ts.failedTitle}>
                                            Your personalised report is on its way
                                        </h3>
                                        <p style={ts.failedSub}>
                                            We’re putting the finishing touches on your report. It will be emailed to{' '}
                                            <strong>{upgradeInfo?.student.email ?? 'you'}</strong> within 24 hours —
                                            there’s nothing you need to do.
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
                                    {showCounsellingButton && !bookedAppointment && !hasMappingCounselling && (
                                        <div
                                            onClick={handleOpenSlotPicker}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(16, 185, 129, 0.4)',
                                                width: '100%',
                                                maxWidth: '520px',
                                                margin: '0 auto',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(16, 185, 129, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(16, 185, 129, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                display: 'inline-block',
                                                background: 'rgba(255,255,255,0.25)',
                                                color: '#fff',
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.08em',
                                                padding: '2px 10px',
                                                borderRadius: 999,
                                                marginBottom: '0.6rem',
                                            }}>
                                                NEXT STEP
                                            </div>
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
                                                Choose your counselling time
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                {counsellingRemainingFromUpgradeInfo} session{counsellingRemainingFromUpgradeInfo === 1 ? '' : 's'} ready to book
                                            </p>
                                        </div>
                                    )}

                                    {/* Book Counselling — school student (resolved by userStudentId,
                                        no B2C entitlement on this page). Same tile/picker as B2C. */}
                                    {!upgradeInfo && schoolCounselling && schoolCounselling.offered && !bookedAppointment && !hasMappingCounselling && (
                                        <div
                                            onClick={handleOpenSlotPicker}
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 10px 35px rgba(16, 185, 129, 0.4)',
                                                width: '100%',
                                                maxWidth: '520px',
                                                margin: '0 auto',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 15px 45px rgba(16, 185, 129, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 35px rgba(16, 185, 129, 0.4)';
                                            }}
                                        >
                                            <div style={{
                                                display: 'inline-block',
                                                background: 'rgba(255,255,255,0.25)',
                                                color: '#fff',
                                                fontSize: '0.62rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.08em',
                                                padding: '2px 10px',
                                                borderRadius: 999,
                                                marginBottom: '0.6rem',
                                            }}>
                                                NEXT STEP
                                            </div>
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
                                                Book your career counselling
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                Pick a slot to talk to a counsellor
                                            </p>
                                        </div>
                                    )}

                                    {/* Counselling booked confirmation — full-width, matches the B2B
                                        mapping "You're all set" card: light-mint card, eyebrow label,
                                        outline check icon, dark-green text. No counsellor name, no emoji. */}
                                    {bookedAppointment && !hasMappingCounselling && (
                                        <div
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                                                border: '1.5px solid #6EE7B7',
                                                borderRadius: '16px',
                                                padding: '1.75rem 1.5rem',
                                                boxShadow: '0 10px 30px rgba(16,185,129,0.15)',
                                                width: '100%',
                                                maxWidth: '520px',
                                                margin: '0 auto',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                                                Career counselling
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                                                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M8 12l3 3 5-6"></path>
                                                </svg>
                                            </div>
                                            <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#065F46' }}>
                                                You're all set — your session is booked!
                                            </h3>
                                            {(bookedAppointment.slotDate && bookedAppointment.slotStartTime) && (
                                                <p style={{ margin: '0 0 14px', fontSize: '0.95rem', color: '#047857', fontWeight: 700 }}>
                                                    {formatApptWhen(bookedAppointment.slotDate, bookedAppointment.slotStartTime)}
                                                </p>
                                            )}
                                            <p style={{ margin: '0 0 4px', fontSize: '0.88rem', color: '#059669', lineHeight: 1.5 }}>
                                                We've sent the details to your email and WhatsApp.
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#059669', lineHeight: 1.5 }}>
                                                Great job taking this step!
                                            </p>
                                        </div>
                                    )}

                                    {/* Counselling request forwarded — no counsellor mapped yet.
                                        Shown instead of a slot picker so the student knows their
                                        request reached Career-9 and how to follow up. */}
                                    {pendingCounselling && !schoolCounselling && !bookedAppointment && !hasMappingCounselling && (
                                        <div
                                            className="text-center"
                                            style={{
                                                background: 'linear-gradient(135deg, #BAE6FD 0%, #38BDF8 100%)',
                                                borderRadius: '16px',
                                                padding: '1.25rem 1.5rem',
                                                boxShadow: '0 10px 35px rgba(56, 189, 248, 0.35)',
                                                width: '100%',
                                                maxWidth: '520px',
                                                margin: '0 auto',
                                            }}
                                        >
                                            <div style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                background: 'rgba(255,255,255,0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 0.75rem auto',
                                            }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                </svg>
                                            </div>
                                            <h3 style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Counselling request received
                                            </h3>
                                            <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.8rem', lineHeight: '1.4', margin: 0 }}>
                                                Your request for career counselling has been forwarded to the Career-9 team. We'll match you with a counsellor and reach out shortly.
                                                <br />
                                                <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                                                    Need it sooner? Write to{' '}
                                                    <a href={`mailto:${pendingCounselling.supportEmail}`} style={{ color: 'white', fontWeight: 700 }}>
                                                        {pendingCounselling.supportEmail}
                                                    </a>
                                                </span>
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
                                            maxWidth: '520px',
                                            margin: '0 auto',
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

            {/* Pre-picker reminder — a single, focused nudge shown BEFORE the slot
                picker (never stacked on top of it). "Pick my counselling time" opens
                the picker; "Maybe later" dismisses it, leaving the Book-counselling
                card on the page to open whenever the student is ready. */}
            {showCounsellingReminder && !isSlotPickerOpen && !bookedAppointment && (
                <div style={overlayStyle(1100)} onClick={() => setShowCounsellingReminder(false)}>
                    <div onClick={(e) => e.stopPropagation()} style={celebrationCardStyle}>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
                            </svg>
                        </div>
                        <h3 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800, color: '#065F46' }}>
                            Don't leave this on the table
                        </h3>
                        <p style={{ margin: '0 0 20px', fontSize: '0.95rem', lineHeight: 1.6, color: '#047857' }}>
                            You just finished your assessment. A one-on-one session turns those results into a
                            real plan for your future — and it only takes a moment to pick a time.
                        </p>
                        <button
                            type="button"
                            onClick={() => { setShowCounsellingReminder(false); setIsSlotPickerOpen(true); }}
                            style={{ ...primaryBtnStyle, marginBottom: 10 }}
                        >
                            Pick my counselling time
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowCounsellingReminder(false)}
                            style={{
                                background: 'transparent', border: 'none', color: '#94A3B8',
                                fontSize: '0.86rem', fontWeight: 500, cursor: 'pointer',
                                textDecoration: 'underline', width: '100%', padding: '0.4rem',
                            }}
                        >
                            No thanks, maybe later
                        </button>
                    </div>
                </div>
            )}

            {/* Counselling slot picker — modal overlay. Rendered at the fragment
                level so its fixed-position backdrop covers the full viewport
                regardless of the layered backgrounds the page draws. Mounted
                only while open so its initial slot-list fetch fires on each
                open, not on every render. */}
            {isSlotPickerOpen && (upgradeInfo?.accessToken || schoolCounselling?.accessToken) && (
                <CounsellingSlotPicker
                    accessToken={(upgradeInfo?.accessToken || schoolCounselling?.accessToken) as string}
                    entitlementId={(upgradeInfo?.entitlementId ?? schoolCounselling?.entitlementId) as number}
                    sessionsRemaining={upgradeInfo ? counsellingRemainingFromUpgradeInfo : (schoolCounselling?.sessionsRemaining ?? 0)}
                    onClose={handleSlotPickerClose}
                    onBooked={handleSlotBooked}
                    defaultName={upgradeInfo?.student?.name ?? schoolCounselling?.studentName}
                    defaultEmail={upgradeInfo?.student?.email ?? schoolCounselling?.studentEmail}
                    defaultPhone={upgradeInfo?.student?.phone ?? schoolCounselling?.studentPhone}
                />
            )}


            {/* Celebratory affirmation right after a successful booking. */}
            {showBookedCelebration && bookedAppointment && (
                <div style={overlayStyle(1100)} onClick={() => setShowBookedCelebration(false)}>
                    <div onClick={(e) => e.stopPropagation()} style={celebrationCardStyle}>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-6" />
                            </svg>
                        </div>
                        <h3 style={{ margin: '0 0 10px', fontSize: '1.3rem', fontWeight: 800, color: '#065F46' }}>
                            You just made a great decision
                        </h3>
                        <p style={{ margin: '0 0 16px', fontSize: '0.92rem', lineHeight: 1.6, color: '#047857' }}>
                            Booking this session is one of the smartest moves you can make for your future. This is where
                            your assessment turns into a real plan.
                        </p>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: '#fff', border: '1.5px solid #6EE7B7', borderRadius: 12,
                            padding: '10px 18px', marginBottom: 20,
                            fontWeight: 800, color: '#065F46', fontSize: '0.98rem',
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                            </svg>
                            <span>{formatApptWhen(bookedAppointment.slotDate, bookedAppointment.slotStartTime) || 'Your counsellor will reach out shortly'}</span>
                        </div>
                        <button type="button" onClick={() => setShowBookedCelebration(false)} style={{ ...primaryBtnStyle, width: '100%' }}>
                            Got it!
                        </button>
                    </div>
                </div>
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

// ── Modal styles (cancel-confirm + booking celebration) ──
const overlayStyle = (z: number): React.CSSProperties => ({
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, zIndex: z, backdropFilter: 'blur(2px)',
});
const celebrationCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
    border: '1.5px solid #6EE7B7', borderRadius: 18, maxWidth: 420, width: '100%',
    padding: '2rem 1.75rem', boxShadow: '0 24px 70px rgba(16,185,129,0.3)',
    fontFamily: 'inherit', textAlign: 'center',
};
const primaryBtnStyle: React.CSSProperties = {
    padding: '13px 20px', border: 'none', borderRadius: 12,
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff', fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16,185,129,0.32)', width: '100%',
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
                <span style={{ ...ts.trustItem, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Secure checkout
                </span>
                <span style={ts.trustDot} />
                <span style={{ ...ts.trustItem, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
                    </svg>
                    Report emailed within minutes
                </span>
                <span style={ts.trustDot} />
                <span style={{ ...ts.trustItem, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
                    </svg>
                    Trusted by Career-9 students
                </span>
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
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 100%)',
        border: '1px solid #C7D2FE',
        borderRadius: 18,
        padding: '1.5rem 1.25rem',
        margin: '0 auto 1.5rem',
        width: '100%',
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    failedOrb: {
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #E0E7FF, #C7D2FE)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    failedTitle: {
        color: '#3730A3',
        fontWeight: 700,
        fontSize: '1.05rem',
        margin: '4px 0 6px',
        textAlign: 'center',
    },
    failedSub: {
        color: '#4338CA',
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
