import { useCallback, useEffect, useState } from "react";
import { Form, Spinner, Tab, Tabs } from "react-bootstrap";
import { showErrorToast } from "../../../utils/toast";
import { Campaign, getAllCampaigns } from "../API/Campaign_APIs";
import {
  AllotmentRow,
  InstituteOption,
  PaymentRow,
  getAllotments,
  getInstituteList,
  getPayments,
  getSummary,
  TrackerFilters,
} from "../API/Tracker_APIs";
import AllotmentsTab from "./components/AllotmentsTab";
import EntitlementDrawer from "./components/EntitlementDrawer";
import KpiHeader from "./components/KpiHeader";
import PaymentsTab from "./components/PaymentsTab";

const PAGE_SIZE = 50;

const TrackerPage = () => {
  const [activeTab, setActiveTab] = useState<string>("payments");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [filters, setFilters] = useState<TrackerFilters>({ page: 0, size: PAGE_SIZE });

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [allotments, setAllotments] = useState<AllotmentRow[]>([]);
  const [allotmentsTotal, setAllotmentsTotal] = useState(0);

  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const [drawerEntitlementId, setDrawerEntitlementId] = useState<number | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await getAllCampaigns();
      setCampaigns(res.data);
    } catch { /* non-fatal */ }
  }, []);

  const loadInstitutes = useCallback(async () => {
    try {
      const res = await getInstituteList();
      setInstitutes(res.data);
    } catch { /* non-fatal */ }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getSummary({ campaignId: filters.campaignId, from: filters.from, to: filters.to });
      setSummary(res.data);
    } catch { /* non-fatal */ }
  }, [filters.campaignId, filters.from, filters.to]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPayments(filters);
      setPayments(res.data.rows);
      setPaymentsTotal(res.data.total);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadAllotments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllotments(filters);
      setAllotments(res.data.rows);
      setAllotmentsTotal(res.data.total);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load allotments");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => { loadInstitutes(); }, [loadInstitutes]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (activeTab === "payments") loadPayments();
    else if (activeTab === "allotments") loadAllotments();
  }, [activeTab, loadPayments, loadAllotments]);

  const upd = <K extends keyof TrackerFilters>(k: K, v: TrackerFilters[K]) =>
    setFilters(prev => ({ ...prev, [k]: v, page: 0 }));

  const setPage = (p: number) => setFilters(prev => ({ ...prev, page: p }));

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h1>B2C Tracker</h1>
          <small className="text-muted">Payments and allotted services across campaigns</small>
        </div>
      </div>

      <div className="card-body pt-3">
        <KpiHeader summary={summary} />

        <div className="row mb-3 mt-4">
          <div className="col-md-3 mb-2">
            <Form.Label className="small fw-bold">Campaign</Form.Label>
            <Form.Select size="sm" value={filters.campaignId ?? ""} onChange={e => upd("campaignId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">All campaigns</option>
              {campaigns.map(c => (<option key={c.campaignId} value={c.campaignId}>{c.name}</option>))}
            </Form.Select>
          </div>
          <div className="col-md-2 mb-2">
            <Form.Label className="small fw-bold">From (dd-MM-yyyy)</Form.Label>
            <Form.Control size="sm" value={filters.from ?? ""} onChange={e => upd("from", e.target.value || undefined)} placeholder="01-04-2026" />
          </div>
          <div className="col-md-2 mb-2">
            <Form.Label className="small fw-bold">To (dd-MM-yyyy)</Form.Label>
            <Form.Control size="sm" value={filters.to ?? ""} onChange={e => upd("to", e.target.value || undefined)} placeholder="30-04-2026" />
          </div>
          <div className="col-md-2 mb-2">
            <Form.Label className="small fw-bold">Status</Form.Label>
            {activeTab === "payments" ? (
              <Form.Select size="sm" value={filters.status ?? ""} onChange={e => upd("status", e.target.value || undefined)}>
                <option value="">All</option>
                <option value="created">Created</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </Form.Select>
            ) : (
              <Form.Select size="sm" value={filters.status ?? ""} onChange={e => upd("status", e.target.value || undefined)}>
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
                <option value="refunded">Refunded</option>
              </Form.Select>
            )}
          </div>
          <div className="col-md-3 mb-2">
            <Form.Label className="small fw-bold">Search</Form.Label>
            <Form.Control size="sm" value={filters.q ?? ""} onChange={e => upd("q", e.target.value || undefined)} placeholder="name / email / phone" />
          </div>
        </div>

        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || "payments")} className="mb-3">
          <Tab eventKey="payments" title={`Payments (${paymentsTotal})`}>
            {loading && <Spinner animation="border" />}
            {!loading && (
              <PaymentsTab
                rows={payments}
                total={paymentsTotal}
                page={filters.page ?? 0}
                pageSize={filters.size ?? PAGE_SIZE}
                institutes={institutes}
                onPageChange={setPage}
                onOpenEntitlement={setDrawerEntitlementId}
                onInstituteChanged={loadPayments}
              />
            )}
          </Tab>
          <Tab eventKey="allotments" title={`Allotments (${allotmentsTotal})`}>
            {loading && <Spinner animation="border" />}
            {!loading && (
              <AllotmentsTab
                rows={allotments}
                total={allotmentsTotal}
                page={filters.page ?? 0}
                pageSize={filters.size ?? PAGE_SIZE}
                institutes={institutes}
                onPageChange={setPage}
                onOpenEntitlement={setDrawerEntitlementId}
                onInstituteChanged={loadAllotments}
              />
            )}
          </Tab>
        </Tabs>
      </div>

      <EntitlementDrawer
        entitlementId={drawerEntitlementId}
        onClose={() => setDrawerEntitlementId(null)}
        onChanged={() => { loadPayments(); loadAllotments(); loadSummary(); }}
      />
    </div>
  );
};

export default TrackerPage;
