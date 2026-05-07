import axios from "axios";
import { useEffect, useState } from "react";
import { Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import {
  attachAssessment,
  attachTierToMapping,
  Campaign,
  CampaignAssessmentRow,
  createCampaign,
  detachAssessment,
  detachTierFromMapping,
  getCampaign,
  updateAssessmentMapping,
  updateCampaign,
} from "../API/Campaign_APIs";
import { getActivePricingTiers, PricingTier } from "../API/PricingTier_APIs";
import RegistrationLinks from "./components/RegistrationLinks";

const API_URL = process.env.REACT_APP_API_URL;

const emptyCampaign: Campaign = {
  name: "",
  slug: "",
  brandLogoUrl: "",
  targetAudience: "",
  description: "",
  defaultPurchasePath: "B",
  defaultCounsellingModel: "1",
  isActive: true,
};

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

const CampaignEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [campaign, setCampaign] = useState<Campaign>(emptyCampaign);
  const [assessmentRows, setAssessmentRows] = useState<CampaignAssessmentRow[]>([]);
  const [allAssessments, setAllAssessments] = useState<{ id: number; name: string }[]>([]);
  const [allTiers, setAllTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tier-config drawer state
  const [tierDrawerOpenFor, setTierDrawerOpenFor] = useState<CampaignAssessmentRow | null>(null);

  const upd = <K extends keyof Campaign>(k: K, v: Campaign[K]) =>
    setCampaign(prev => ({ ...prev, [k]: v }));

  const loadAssessments = async () => {
    try {
      const res = await axios.get(`${API_URL}/assessments/get/list`);
      const list = (res.data as any[]).map(a => ({
        id: a.assessment_id ?? a.assessmentId ?? a.id,
        name: a.AssessmentName ?? a.assessmentName ?? a.name ?? `Assessment ${a.id}`,
      }));
      setAllAssessments(list);
    } catch {
      // non-fatal
    }
  };

  const loadTiers = async () => {
    try {
      const res = await getActivePricingTiers();
      setAllTiers(res.data);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load pricing tiers");
    }
  };

  const loadCampaign = async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getCampaign(Number(id));
      setCampaign(res.data.campaign);
      setAssessmentRows(res.data.assessments || []);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAssessments(); loadTiers(); loadCampaign(); /* eslint-disable-next-line */ }, [id]);

  const handleSaveBasics = async () => {
    if (!campaign.name?.trim()) { showErrorToast("Name is required"); return; }
    if (!campaign.slug?.trim()) { showErrorToast("Slug is required"); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateCampaign(Number(id), campaign);
        showSuccessToast("Campaign updated");
      } else {
        const res = await createCampaign(campaign);
        showSuccessToast("Campaign created");
        navigate(`/b2c/campaigns/edit/${res.data.campaignId}`);
      }
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAttachAssessment = async (assessmentId: number) => {
    if (!campaign.campaignId) { showErrorToast("Save the campaign first"); return; }
    try {
      await attachAssessment(campaign.campaignId, { assessmentId });
      await loadCampaign();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to attach");
    }
  };

  const handleDetach = async (mappingId: number) => {
    if (!window.confirm("Detach this assessment from the campaign?")) return;
    try {
      await detachAssessment(mappingId);
      await loadCampaign();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to detach");
    }
  };

  const handleMappingFieldChange = async (
    row: CampaignAssessmentRow,
    field: "purchasePath" | "counsellingModel",
    value: string
  ) => {
    const body: any = {};
    body[field] = value === "INHERIT" ? null : value;
    try {
      await updateAssessmentMapping(row.mappingId, body);
      await loadCampaign();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to update");
    }
  };

  const availableAssessmentsToAttach = allAssessments.filter(
    a => !assessmentRows.some(r => r.assessmentId === a.id)
  );

  return (
    <div className="card">
      <div className="card-header border-0 pt-6 d-flex justify-content-between align-items-center">
        <div className="card-title">
          <h1>{isEdit ? "Configure Campaign" : "New Campaign"}</h1>
          {isEdit && campaign.slug && (
            <small className="text-muted">Public: <code>/c/{campaign.slug}</code></small>
          )}
        </div>
        <div className="card-toolbar">
          <Button variant="outline-secondary" className="me-2" onClick={() => navigate("/b2c/campaigns")}>← Back</Button>
        </div>
      </div>

      <div className="card-body pt-5">
        {loading && <Spinner animation="border" />}
        {!loading && (
          <>
            <h4 className="mb-3">Basics</h4>
            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Label>Campaign name</Form.Label>
                <Form.Control value={campaign.name} onChange={e => {
                  upd("name", e.target.value);
                  if (!isEdit && !campaign.slug) upd("slug", slugify(e.target.value));
                }} />
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>Slug</Form.Label>
                <Form.Control value={campaign.slug} onChange={e => upd("slug", slugify(e.target.value))} />
                <Form.Text className="text-muted">Public landing path — /c/{campaign.slug || "your-slug"}</Form.Text>
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>Target audience</Form.Label>
                <Form.Control value={campaign.targetAudience ?? ""} onChange={e => upd("targetAudience", e.target.value)} placeholder="Class 11–12, Science stream" />
              </div>
              <div className="col-md-6 mb-3">
                <Form.Label>Brand logo URL</Form.Label>
                <Form.Control value={campaign.brandLogoUrl ?? ""} onChange={e => upd("brandLogoUrl", e.target.value)} />
              </div>
              <div className="col-12 mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={2} value={campaign.description ?? ""} onChange={e => upd("description", e.target.value)} />
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Valid from (dd-MM-yyyy)</Form.Label>
                <Form.Control value={campaign.validFrom ?? ""} onChange={e => upd("validFrom", e.target.value)} placeholder="01-05-2026" />
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Valid to (dd-MM-yyyy)</Form.Label>
                <Form.Control value={campaign.validTo ?? ""} onChange={e => upd("validTo", e.target.value)} placeholder="30-06-2026" />
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Default purchase path</Form.Label>
                <Form.Select value={campaign.defaultPurchasePath ?? "B"} onChange={e => upd("defaultPurchasePath", e.target.value as "A" | "B")}>
                  <option value="A">A — Pay First, Then Discover</option>
                  <option value="B">B — Try First, Then Commit</option>
                </Form.Select>
              </div>
              <div className="col-md-3 mb-3">
                <Form.Label>Default counselling model</Form.Label>
                <Form.Select value={campaign.defaultCounsellingModel ?? "1"} onChange={e => upd("defaultCounsellingModel", e.target.value as "1" | "2")}>
                  <option value="1">Model 1 — Self-Serve</option>
                  <option value="2">Model 2 — Admin-Assigned</option>
                </Form.Select>
              </div>
              <div className="col-12 mb-3">
                <Form.Check type="switch" id="ca-active" label="Campaign is live (visible to students)" checked={!!campaign.isActive} onChange={e => upd("isActive", e.target.checked)} />
              </div>
            </div>

            <Button variant="primary" onClick={handleSaveBasics} disabled={saving}>
              {saving ? <Spinner size="sm" animation="border" /> : (isEdit ? "Save changes" : "Create campaign")}
            </Button>

            {isEdit && (
              <>
                <hr className="my-5" />
                <h4 className="mb-3">Assessments in this campaign</h4>
                <p className="text-muted">For each assessment you can override Path and Counselling Model, and pick which pricing tiers to sell.</p>

                {availableAssessmentsToAttach.length > 0 && (
                  <Form.Group className="mb-3">
                    <Form.Label>Attach an assessment</Form.Label>
                    <Form.Select onChange={e => { if (e.target.value) handleAttachAssessment(Number(e.target.value)); e.target.value = ""; }}>
                      <option value="">— pick an assessment to attach —</option>
                      {availableAssessmentsToAttach.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}

                <Table responsive striped hover className="align-middle">
                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Path override</th>
                      <th>Counselling override</th>
                      <th>Tiers</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentRows.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted py-4">No assessments attached yet.</td></tr>
                    )}
                    {assessmentRows.map(r => (
                      <tr key={r.mappingId}>
                        <td><strong>{r.assessmentName}</strong></td>
                        <td>
                          <Form.Select size="sm" value={r.purchasePath ?? "INHERIT"}
                            onChange={e => handleMappingFieldChange(r, "purchasePath", e.target.value)}>
                            <option value="INHERIT">Inherit ({campaign.defaultPurchasePath})</option>
                            <option value="A">Path A</option>
                            <option value="B">Path B</option>
                          </Form.Select>
                        </td>
                        <td>
                          <Form.Select size="sm" value={r.counsellingModel ?? "INHERIT"}
                            onChange={e => handleMappingFieldChange(r, "counsellingModel", e.target.value)}>
                            <option value="INHERIT">Inherit (Model {campaign.defaultCounsellingModel})</option>
                            <option value="1">Model 1 — Self-serve</option>
                            <option value="2">Model 2 — Admin-assigned</option>
                          </Form.Select>
                        </td>
                        <td>
                          {(r.tiers ?? []).filter(t => t.isActive).length} active tier(s)
                        </td>
                        <td>
                          <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setTierDrawerOpenFor(r)}>Configure tiers</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => handleDetach(r.mappingId)}>Detach</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
          </>
        )}
      </div>

      <TierConfigDrawer
        show={!!tierDrawerOpenFor}
        row={tierDrawerOpenFor}
        allTiers={allTiers}
        onClose={() => setTierDrawerOpenFor(null)}
        onChanged={loadCampaign}
      />

      {isEdit && campaign.slug && (
        <RegistrationLinks
          slug={campaign.slug}
          assessments={assessmentRows.map(r => ({
            assessmentId: r.assessmentId,
            assessmentName: r.assessmentName || `Assessment #${r.assessmentId}`,
            tiers: (r.tiers ?? [])
              .filter(t => t.isActive !== false)
              .map(t => ({
                campaignAssessmentTierId: t.id,
                pricingTierId: t.pricingTierId,
                name: allTiers.find(pt => pt.tierId === t.pricingTierId)?.name,
              })),
          }))}
        />
      )}
    </div>
  );
};

interface TierConfigDrawerProps {
  show: boolean;
  row: CampaignAssessmentRow | null;
  allTiers: PricingTier[];
  onClose: () => void;
  onChanged: () => void;
}

const TierConfigDrawer = ({ show, row, allTiers, onClose, onChanged }: TierConfigDrawerProps) => {
  const [busy, setBusy] = useState<number | null>(null);

  if (!row) return null;
  const attachedByPricingTier = new Map<number, NonNullable<CampaignAssessmentRow["tiers"]>[number]>();
  (row.tiers ?? []).forEach(t => attachedByPricingTier.set(t.pricingTierId, t));

  const toggleAttach = async (tier: PricingTier, checked: boolean) => {
    if (!tier.tierId) return;
    setBusy(tier.tierId);
    try {
      await attachTierToMapping(row.mappingId, {
        pricingTierId: tier.tierId,
        isActive: checked,
      });
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const setOverride = async (tier: PricingTier, val: string) => {
    if (!tier.tierId) return;
    setBusy(tier.tierId);
    try {
      const priceOverrideInr = val === "" ? null : Number(val);
      await attachTierToMapping(row.mappingId, {
        pricingTierId: tier.tierId,
        priceOverrideInr,
      });
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const setDefault = async (tier: PricingTier) => {
    if (!tier.tierId) return;
    setBusy(tier.tierId);
    try {
      await attachTierToMapping(row.mappingId, {
        pricingTierId: tier.tierId,
        isDefault: true,
        isActive: true,
      });
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusy(null);
    }
  };

  const removeTier = async (mapId: number) => {
    setBusy(mapId);
    try {
      await detachTierFromMapping(mapId);
      onChanged();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Tiers for "{row.assessmentName}"</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {allTiers.length === 0 && <p className="text-muted">Create some pricing tiers first.</p>}
        <Table responsive className="align-middle">
          <thead>
            <tr>
              <th>Sell?</th>
              <th>Tier</th>
              <th>Base price</th>
              <th>Override price (paise)</th>
              <th>Default?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allTiers.map(t => {
              const att = attachedByPricingTier.get(t.tierId!);
              return (
                <tr key={t.tierId}>
                  <td>
                    <Form.Check type="switch" id={`sell-${t.tierId}`}
                      checked={!!att?.isActive}
                      disabled={busy === t.tierId}
                      onChange={e => toggleAttach(t, e.target.checked)} />
                  </td>
                  <td>
                    <strong>{t.name}</strong>
                    <div>
                      {t.includesFinalReport && <span className="badge bg-success me-1">Report</span>}
                      {t.includesDashboard && <span className="badge bg-success me-1">Dash</span>}
                      {t.includesCounselling && <span className="badge bg-success me-1">Counsel</span>}
                      {t.includesLms && <span className="badge bg-success me-1">LMS</span>}
                    </div>
                  </td>
                  <td>₹{((t.basePriceInr ?? 0) / 100).toLocaleString("en-IN")}</td>
                  <td>
                    <Form.Control
                      size="sm"
                      type="number"
                      placeholder="(use base)"
                      defaultValue={att?.priceOverrideInr ?? ""}
                      onBlur={e => setOverride(t, e.target.value)}
                      disabled={!att?.isActive}
                    />
                  </td>
                  <td>
                    {att?.isDefault
                      ? <span className="badge bg-info">Default</span>
                      : <Button size="sm" variant="outline-secondary" disabled={!att?.isActive} onClick={() => setDefault(t)}>Make default</Button>}
                  </td>
                  <td>
                    {att && (
                      <Button size="sm" variant="outline-danger" onClick={() => removeTier(att.id)}>Remove</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CampaignEditPage;
