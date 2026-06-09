import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

export interface DashboardTierOption {
  campaignAssessmentTierId: number;
  name: string;
  priceInr: number;
  includesDashboard: boolean;
  includesFinalReport?: boolean;
  includesCounselling?: boolean;
  counsellingSessionCount?: number;
  includesLms?: boolean;
  dashboardValidityDays?: number;
}

export interface DashboardOptionsResponse {
  campaignId: number | null;
  assessmentId: number | null;
  options: DashboardTierOption[];
}

export interface CheckoutLinkResponse {
  transactionId: number;
  shortUrl: string;
  razorpayLinkId: string;
  amount: number;
  status: string;
}

/** Tiers the logged-in student can buy to unlock their own dashboard. */
export function getDashboardCheckoutOptions() {
  return axios.get<DashboardOptionsResponse>(`${API_URL}/student-checkout/dashboard-options`);
}

/** Create a Razorpay payment link for the chosen tier. Redirect to shortUrl.
 *  returnUrl is where Razorpay sends the student after payment (keeps them in
 *  this app rather than the campaign callback origin). */
export function createDashboardCheckoutLink(campaignAssessmentTierId: number, returnUrl?: string) {
  return axios.post<CheckoutLinkResponse>(`${API_URL}/student-checkout/dashboard-link`, {
    campaignAssessmentTierId,
    returnUrl,
  });
}

export interface CheckoutStatusResponse {
  status: "created" | "paid" | "failed" | "expired" | "cancelled" | string;
  amount?: number;
  transactionId?: number;
  assessmentId?: number;
  assessmentName?: string;
  failureReason?: string;
}

/** Poll payment status by Razorpay link id. reconcile=1 makes the backend
 *  confirm against Razorpay and provision the entitlement even if the webhook
 *  is delayed. */
export function getCheckoutStatus(razorpayLinkId: string) {
  return axios.get<CheckoutStatusResponse>(
    `${API_URL}/payment/webhook/status/${encodeURIComponent(razorpayLinkId)}`,
    { params: { reconcile: 1 } }
  );
}
