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

export function payForUpgrade(entitlementId: number | string) {
  return http.post('/assessment-mapping/public/pay-for-upgrade', { entitlementId });
}
