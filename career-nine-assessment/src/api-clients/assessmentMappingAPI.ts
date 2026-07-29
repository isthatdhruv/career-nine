import http from '../api/http';
import type { StudentBranding } from '../hooks/useStudentBranding';

export type MappingInclusions = {
  includesFinalReport: boolean;
  includesDashboard: boolean;
  includesCounselling: boolean;
  counsellingSessionCount?: number | null;
  includesLms: boolean;
  lmsValidityDays?: number | null;
  dashboardValidityDays?: number | null;
};

export type MappingSection = { id: number; sectionName: string };
export type MappingClass = {
  id: number;
  className: string;
  schoolSections?: MappingSection[];
  sections?: MappingSection[];
};
export type MappingSession = {
  id: number;
  sessionYear: string;
  classes: Array<{
    id: number;
    className: string;
    sections: MappingSection[];
  }>;
};

export type MappingInfo = {
  linkType: 'FREE' | 'PAID';
  amount: number;
  registrationClosed: boolean;
  mappingLevel: 'INSTITUTE' | 'SESSION' | 'CLASS' | 'SECTION';
  assessmentId: number;
  assessmentName: string;
  instituteCode: string;
  instituteName: string;
  inclusions: MappingInclusions;
  activeTierName?: string;
  // Post-assessment counselling payment timing + fee breakdown (PAID links only).
  // PAY_FIRST folds the counselling fee into the registration total; PAY_LATER
  // defers it to per-slot booking after the assessment.
  paymentTiming?: 'PAY_FIRST' | 'PAY_LATER';
  // The amount actually charged at registration: PAY_FIRST = amount + counsellingFeeTotal,
  // PAY_LATER = amount. Use this as the headline price; `amount` is the assessment line item.
  payableTotal?: number;
  counsellingFeePerSession?: number;
  counsellingSessionCount?: number;
  counsellingFeeTotal?: number;
  sessionId?: number;
  sessionYear?: string;
  classId?: number;
  className?: string;
  sectionId?: number;
  sectionName?: string;
  availableClasses?: MappingClass[];
  availableSections?: MappingSection[];
  availableSessions?: MappingSession[];
  branding?: StudentBranding;
};

export function getMappingInfoByToken(token: string) {
  return http.get<MappingInfo>(`/assessment-mapping/public/info/${token}`);
}

export function registerStudentByToken(
  token: string,
  studentData: {
    name: string;
    email: string;
    dob: string;
    phone: string;
    gender: string;
    classId?: number;
    schoolSectionId?: number;
    promoCode?: string;
  }
) {
  return http.post(`/assessment-mapping/public/register/${token}`, studentData);
}

export type UpgradeInfo = {
  entitlementId: number;
  available: boolean;
  amount?: number;
  tierName?: string;
  inclusions?: MappingInclusions;
  current: {
    finalReportActive: boolean;
    dashboardActive: boolean;
    counsellingActive: boolean;
    lmsActive: boolean;
  };
  assessmentName?: string;
};

export function getUpgradeInfo(entitlementId: number | string) {
  return http.get<UpgradeInfo>(`/assessment-mapping/public/upgrade-info/${entitlementId}`);
}

// Optional tierId lets the student pick a specific tier from the post-assessment
// dropdown; omitted, the backend resolves the active paid wave (legacy upsell).
export function payForUpgrade(entitlementId: number | string, tierId?: number) {
  return http.post('/assessment-mapping/public/pay-for-upgrade',
    tierId != null ? { entitlementId, tierId } : { entitlementId });
}

// ── Post-assessment counselling tier selection ──────────────────────────────
export type CounsellingTierOption = {
  tierId: number;
  name: string;
  description?: string | null;
  amount: number;
  counsellingPrice?: number | null;
  inclusions: MappingInclusions;
};

export type CounsellingOptions = {
  entitlementId: number;
  paymentTiming: 'PAY_FIRST' | 'PAY_LATER';
  counsellingActive: boolean;
  sessionsRemaining: number;
  canBookNow: boolean;
  accessToken?: string | null;
  assessmentName?: string;
  needsTierSelection: boolean;
  tiers: CounsellingTierOption[];
  // PAY_LATER per-slot booking: pay the fee each time a slot is booked.
  payPerSlot?: boolean;
  counsellingFeePerSession?: number | null;
};

export function getCounsellingOptions(entitlementId: number | string) {
  return http.get<CounsellingOptions>(
    `/assessment-mapping/public/counselling-options/${entitlementId}`);
}

// Resolves the same options by (userStudentId, assessmentId) — used on the
// thank-you page where a mapping student has no entitlementId in hand.
export function getCounsellingOptionsByStudent(
  userStudentId: number | string,
  assessmentId: number | string,
) {
  return http.get<CounsellingOptions>(
    '/assessment-mapping/public/counselling-options-by-student',
    { params: { userStudentId, assessmentId } });
}

// ── PAY_LATER counselling: list slots before payment, then hold + pay ────────
export type CounsellingSlot = {
  slotId: number;
  date: string;        // yyyy-MM-dd
  startTime: string;   // HH:mm:ss
  endTime: string;     // HH:mm:ss
  durationMinutes: number;
  counsellorName?: string;
  mode?: 'ONLINE' | 'OFFLINE';
  booked?: boolean;    // already taken by another student — shown greyed, not bookable
};

export function getPayLaterSlots(entitlementId: number | string, from?: string) {
  return http.get<{ slots: CounsellingSlot[] }>(
    '/assessment-mapping/public/counselling-slots',
    { params: from ? { entitlementId, from } : { entitlementId } });
}

export function payLaterBook(body: {
  entitlementId: number | string;
  tierId: number;
  slotId: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  preferredContactMethod?: 'EMAIL' | 'PHONE' | 'WHATSAPP';
}) {
  return http.post('/assessment-mapping/public/pay-later-book', body);
}

// ── Per-student invite (admin-generated, student-locked link) ────────────────
// The link is bound to one already-known student, so the registration page is
// pre-filled from `student` and identity fields are locked. The price is the
// chosen tier's amount; on submit the student pays (PAY_FIRST) and takes the
// assessment — reusing the same payment + provisioning pipeline.
export type InviteInfo = {
  status: 'PENDING' | 'PAID' | 'REVOKED';
  registrationClosed: boolean;
  alreadyRegistered: boolean;
  assessmentId: number;
  assessmentName?: string;
  instituteName?: string;
  tierName?: string;
  amount: number;
  payableTotal?: number;
  inclusions: MappingInclusions;
  paymentTiming?: 'PAY_FIRST' | 'PAY_LATER';
  counsellingFeePerSession?: number;
  counsellingSessionCount?: number;
  counsellingFeeTotal?: number;
  student: { name?: string; email?: string; phone?: string; dob?: string };
  branding?: StudentBranding;
};

export function getInviteInfoByToken(token: string) {
  return http.get<InviteInfo>(`/assessment-mapping/public/student-invite/info/${token}`);
}

export function registerInviteByToken(token: string, body?: { phone?: string }) {
  return http.post(`/assessment-mapping/public/student-invite/register/${token}`, body ?? {});
}
