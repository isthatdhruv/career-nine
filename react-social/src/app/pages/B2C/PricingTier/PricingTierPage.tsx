import { useEffect, useState } from "react";
import { Button, Modal, Form, Table, Spinner } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  PricingTier,
  createPricingTier,
  deletePricingTier,
  getAllPricingTiers,
  updatePricingTier,
} from "../API/PricingTier_APIs";

const emptyTier: PricingTier = {
  name: "",
  description: "",
  basePriceInr: 0,
  currency: "INR",
  includesFinalReport: false,
  includesDashboard: false,
  includesCounselling: false,
  counsellingSessionCount: undefined,
  includesLms: false,
  lmsValidityDays: undefined,
  dashboardValidityDays: undefined,
  sortOrder: 0,
  isActive: true,
};

const formatINR = (paise?: number) => {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
};

const PricingTierPage = () => {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PricingTier>(emptyTier);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllPricingTiers();
      setTiers(res.data);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load pricing tiers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing({ ...emptyTier }); setShowModal(true); };
  const openEdit = (t: PricingTier) => { setEditing({ ...t }); setShowModal(true); };

  const handleSave = async () => {
    if (!editing.name?.trim()) { showErrorToast("Tier name is required"); return; }
    if (editing.basePriceInr == null || editing.basePriceInr < 0) {
      showErrorToast("Base price must be 0 or higher (in paise)"); return;
    }
    setSaving(true);
    try {
      if (editing.tierId) {
        await updatePricingTier(editing.tierId, editing);
        showSuccessToast("Pricing tier updated");
      } else {
        await createPricingTier(editing);
        showSuccessToast("Pricing tier created");
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to save tier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: PricingTier) => {
    if (!t.tierId) return;
    if (!window.confirm(`Delete pricing tier "${t.name}"?`)) return;
    try {
      await deletePricingTier(t.tierId);
      showSuccessToast("Pricing tier deleted");
      load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to delete tier");
    }
  };

  const upd = <K extends keyof PricingTier>(k: K, v: PricingTier[K]) =>
    setEditing(prev => ({ ...prev, [k]: v }));

  return (
    <div className="card">
      <div className="card-header border-0 pt-6 d-flex align-items-center justify-content-between">
        <div className="card-title">
          <h1>Pricing Tiers</h1>
          <small className="text-muted">B2C purchase tiers · re-usable across campaigns</small>
        </div>
        <div className="card-toolbar">
          <Button variant="primary" onClick={openCreate}>+ New Tier</Button>
        </div>
      </div>
      <div className="card-body pt-5">
        {loading && <Spinner animation="border" />}
        {!loading && (
          <Table responsive striped hover className="align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Includes</th>
                <th>Counselling sessions</th>
                <th>Validity (dash · LMS)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tiers.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-5">No pricing tiers yet — create one to get started.</td></tr>
              )}
              {tiers.map(t => (
                <tr key={t.tierId}>
                  <td><strong>{t.name}</strong><br /><small className="text-muted">{t.description}</small></td>
                  <td>{formatINR(t.basePriceInr)}</td>
                  <td>
                    {t.includesFinalReport && <span className="badge bg-success me-1">Final Report</span>}
                    {t.includesDashboard && <span className="badge bg-success me-1">Dashboard</span>}
                    {t.includesCounselling && <span className="badge bg-success me-1">Counselling</span>}
                    {t.includesLms && <span className="badge bg-success me-1">LMS</span>}
                  </td>
                  <td>{t.includesCounselling ? (t.counsellingSessionCount ?? "—") : "—"}</td>
                  <td>
                    {t.includesDashboard ? (t.dashboardValidityDays ?? "lifetime") + "d" : "—"}
                    {" · "}
                    {t.includesLms ? (t.lmsValidityDays ?? "lifetime") + "d" : "—"}
                  </td>
                  <td>{t.isActive ? <span className="badge bg-info">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                  <td>
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDelete(t)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>{editing.tierId ? "Edit pricing tier" : "Create pricing tier"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={editing.name} onChange={e => upd("name", e.target.value)} placeholder="Tier 1 — Final Report only" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={editing.description ?? ""} onChange={e => upd("description", e.target.value)} />
            </Form.Group>
            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Label>Base price (in paise)</Form.Label>
                <Form.Control type="number" value={editing.basePriceInr} onChange={e => upd("basePriceInr", Number(e.target.value))} />
                <Form.Text className="text-muted">Display: {formatINR(editing.basePriceInr)}</Form.Text>
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Currency</Form.Label>
                <Form.Control value={editing.currency} onChange={e => upd("currency", e.target.value)} />
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Sort order</Form.Label>
                <Form.Control type="number" value={editing.sortOrder ?? 0} onChange={e => upd("sortOrder", Number(e.target.value))} />
              </div>
            </div>
            <hr />
            <h6>What's included</h6>
            <div className="row">
              <div className="col-md-6">
                <Form.Check className="mb-2" type="switch" id="incFR" label="Final Report PDF" checked={!!editing.includesFinalReport} onChange={e => upd("includesFinalReport", e.target.checked)} />
                <Form.Check className="mb-2" type="switch" id="incDash" label="Dashboard access" checked={!!editing.includesDashboard} onChange={e => upd("includesDashboard", e.target.checked)} />
                {editing.includesDashboard && (
                  <Form.Group className="mb-3 ms-4">
                    <Form.Label>Dashboard validity (days, 0 = lifetime)</Form.Label>
                    <Form.Control type="number" value={editing.dashboardValidityDays ?? ""} onChange={e => upd("dashboardValidityDays", e.target.value === "" ? undefined : Number(e.target.value))} />
                  </Form.Group>
                )}
              </div>
              <div className="col-md-6">
                <Form.Check className="mb-2" type="switch" id="incC" label="Counselling sessions" checked={!!editing.includesCounselling} onChange={e => upd("includesCounselling", e.target.checked)} />
                {editing.includesCounselling && (
                  <Form.Group className="mb-3 ms-4">
                    <Form.Label>Sessions included</Form.Label>
                    <Form.Control type="number" value={editing.counsellingSessionCount ?? ""} onChange={e => upd("counsellingSessionCount", e.target.value === "" ? undefined : Number(e.target.value))} />
                  </Form.Group>
                )}
                <Form.Check className="mb-2" type="switch" id="incL" label="LMS access" checked={!!editing.includesLms} onChange={e => upd("includesLms", e.target.checked)} />
                {editing.includesLms && (
                  <Form.Group className="mb-3 ms-4">
                    <Form.Label>LMS validity (days, 0 = lifetime)</Form.Label>
                    <Form.Control type="number" value={editing.lmsValidityDays ?? ""} onChange={e => upd("lmsValidityDays", e.target.value === "" ? undefined : Number(e.target.value))} />
                  </Form.Group>
                )}
              </div>
            </div>
            <Form.Check type="switch" id="actv" label="Active (visible in campaigns)" checked={!!editing.isActive} onChange={e => upd("isActive", e.target.checked)} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size="sm" animation="border" /> : (editing.tierId ? "Save changes" : "Create tier")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PricingTierPage;
