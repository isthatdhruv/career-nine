import { useCallback, useEffect, useState } from "react";
import { Form, Spinner, Tab, Tabs } from "react-bootstrap";
import { showErrorToast } from "../../../utils/toast";
import { Campaign, getAllCampaigns } from "../API/Campaign_APIs";
import {
  AllotmentRow,
  InstituteOption,
  PaymentRow,
  ReportErrorRow,
  getAllotments,
  getInstituteList,
  getPayments,
  getReportErrors,
  getSummary,
  TrackerFilters,
} from "../API/Tracker_APIs";
import AllotmentsTab from "./components/AllotmentsTab";
import EntitlementDrawer from "./components/EntitlementDrawer";
import KpiHeader from "./components/KpiHeader";
import PaymentsTab from "./components/PaymentsTab";
import ReportErrorsTab from "./components/ReportErrorsTab";

const PAGE_SIZE = 50;

const toDateInput = (ddmmyyyy?: string): string => {
  if (!ddmmyyyy) return "";
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

const fromDateInput = (yyyymmdd: string): string | undefined => {
  if (!yyyymmdd) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyymmdd);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

const TrackerPage = () => {
  const [activeTab, setActiveTab] = useState<string>("payments");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [filters, setFilters] = useState<TrackerFilters>({ page: 0, size: PAGE_SIZE });

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [allotments, setAllotments] = useState<AllotmentRow[]>([]);
  const [allotmentsTotal, setAllotmentsTotal] = useState(0);
  const [reportErrors, setReportErrors] = useState<ReportErrorRow[]>([]);
  const [reportErrorsTotal, setReportErrorsTotal] = useState(0);
  const [reportErrorsStatus, setReportErrorsStatus] = useState<"failed" | "resolved" | "all">("failed");

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

  const loadReportErrors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReportErrors({ ...filters, status: reportErrorsStatus });
      setReportErrors(res.data.rows);
      setReportErrorsTotal(res.data.total);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load report errors");
    } finally {
      setLoading(false);
    }
  }, [filters, reportErrorsStatus]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => { loadInstitutes(); }, [loadInstitutes]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    if (activeTab === "payments") loadPayments();
    else if (activeTab === "allotments") loadAllotments();
    else if (activeTab === "report-errors") loadReportErrors();
  }, [activeTab, loadPayments, loadAllotments, loadReportErrors]);

  const upd = <K extends keyof TrackerFilters>(k: K, v: TrackerFilters[K]) =>
    setFilters(prev => ({ ...prev, [k]: v, page: 0 }));

  const setPage = (p: number) => setFilters(prev => ({ ...prev, page: p }));

  return (
    <div className="card b2c-tracker-page">
      <div className="card-header border-0 pt-6 flex-wrap">
        <div className="card-title flex-wrap">
          <h1 className="fs-2 fs-md-1 mb-0 me-3">B2C Tracker</h1>
          <small className="text-muted">Payments and allotted services across campaigns</small>
        </div>
      </div>

      <div className="card-body pt-3">
        <KpiHeader summary={summary} />

        <div className="row g-2 mb-3 mt-4">
          <div className="col-12 col-sm-6 col-md-3">
            <Form.Label className="small fw-bold">Campaign</Form.Label>
            <Form.Select size="sm" value={filters.campaignId ?? ""} onChange={e => upd("campaignId", e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">All campaigns</option>
              {campaigns.map(c => (<option key={c.campaignId} value={c.campaignId}>{c.name}</option>))}
            </Form.Select>
          </div>
          <div className="col-6 col-sm-3 col-md-2">
            <Form.Label className="small fw-bold">From</Form.Label>
            <Form.Control type="date" size="sm" value={toDateInput(filters.from)} onChange={e => upd("from", fromDateInput(e.target.value))} max={toDateInput(filters.to)} />
          </div>
          <div className="col-6 col-sm-3 col-md-2">
            <Form.Label className="small fw-bold">To</Form.Label>
            <Form.Control type="date" size="sm" value={toDateInput(filters.to)} onChange={e => upd("to", fromDateInput(e.target.value))} min={toDateInput(filters.from)} />
          </div>
          {activeTab !== "report-errors" && (
            <div className="col-6 col-sm-3 col-md-2">
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
          )}
          <div className={activeTab !== "report-errors" ? "col-12 col-sm-6 col-md-3" : "col-12 col-sm-6 col-md-5"}>
            <Form.Label className="small fw-bold">Search</Form.Label>
            <Form.Control size="sm" value={filters.q ?? ""} onChange={e => upd("q", e.target.value || undefined)} placeholder="name / email / phone" />
          </div>
        </div>

        {activeTab === "allotments" && (
          <div className="mb-3">
            <Form.Check
              type="checkbox"
              id="tracker-include-leads"
              checked={!!filters.includeLeads}
              onChange={e => upd("includeLeads", e.target.checked || undefined)}
              label={
                <span className="small">
                  Include unpaid registrations (Try-First leads)
                  <span className="text-muted ms-2">— students who registered via try-first links but haven't paid for a tier yet</span>
                </span>
              }
            />
          </div>
        )}

        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k || "payments")} className="mb-3 flex-nowrap b2c-tracker-tabs">
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
          <Tab eventKey="report-errors" title={`Report Errors (${reportErrorsTotal})`}>
            {loading && <Spinner animation="border" />}
            {!loading && (
              <ReportErrorsTab
                rows={reportErrors}
                total={reportErrorsTotal}
                page={filters.page ?? 0}
                pageSize={filters.size ?? PAGE_SIZE}
                statusFilter={reportErrorsStatus}
                onStatusFilterChange={(s) => { setReportErrorsStatus(s); setPage(0); }}
                onPageChange={setPage}
                onOpenEntitlement={setDrawerEntitlementId}
                onChanged={() => { loadReportErrors(); loadPayments(); loadAllotments(); }}
              />
            )}
          </Tab>
        </Tabs>
      </div>

      <EntitlementDrawer
        entitlementId={drawerEntitlementId}
        onClose={() => setDrawerEntitlementId(null)}
        onChanged={() => { loadPayments(); loadAllotments(); loadReportErrors(); loadSummary(); }}
      />

      <style>{`
        .b2c-tracker-page .b2c-tracker-tabs {
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .b2c-tracker-page .b2c-tracker-tabs .nav-link {
          white-space: nowrap;
        }
        /* Force horizontal scroll on tables even when an ancestor (.card,
           .card-body, .tab-content) sets overflow:hidden or constrains width.
           Without this, the inline minWidth on the table is honoured but the
           overflow gets clipped instead of scrolled. */
        .b2c-tracker-page .card-body,
        .b2c-tracker-page .tab-content,
        .b2c-tracker-page .tab-pane {
          overflow: visible;
          min-width: 0;
        }
        .b2c-tracker-page .table-responsive {
          display: block;
          width: 100%;
          max-width: 100%;
          overflow-x: auto !important;
          overflow-y: visible;
          -webkit-overflow-scrolling: touch;
        }
        @media (max-width: 575.98px) {
          .b2c-tracker-page .card-header { padding-left: 1rem; padding-right: 1rem; }
          .b2c-tracker-page .card-body { padding-left: 1rem; padding-right: 1rem; }
        }
      `}</style>
    </div>
  );
};

export default TrackerPage;
