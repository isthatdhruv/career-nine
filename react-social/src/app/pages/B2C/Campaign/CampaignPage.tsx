import { useEffect, useState } from "react";
import { Button, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { Campaign, deleteCampaign, getAllCampaigns } from "../API/Campaign_APIs";

const formatDate = (s?: string) => (s ? s.split(" ")[0] : "—");

const CampaignPage = () => {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllCampaigns();
      setRows(res.data);
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (c: Campaign) => {
    if (!c.campaignId) return;
    if (!window.confirm(`Delete campaign "${c.name}"? Existing student entitlements will be honoured.`)) return;
    try {
      await deleteCampaign(c.campaignId);
      showSuccessToast("Campaign deleted");
      load();
    } catch (e: any) {
      showErrorToast(e?.response?.data || "Failed to delete");
    }
  };

  return (
    <div className="card">
      <div className="card-header border-0 pt-6 d-flex align-items-center justify-content-between">
        <div className="card-title">
          <h1>Campaigns</h1>
          <small className="text-muted">B2C campaigns · landing page + assessments + tiers</small>
        </div>
        <div className="card-toolbar">
          <Button variant="primary" onClick={() => navigate("/b2c/campaigns/create")}>+ New Campaign</Button>
        </div>
      </div>
      <div className="card-body pt-5">
        {loading && <Spinner animation="border" />}
        {!loading && (
          <Table responsive striped hover className="align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Validity</th>
                <th>Defaults</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-5">No campaigns yet — create one to start selling direct.</td></tr>
              )}
              {rows.map(c => (
                <tr key={c.campaignId}>
                  <td>
                    <strong>{c.name}</strong>
                    {c.targetAudience && <><br /><small className="text-muted">{c.targetAudience}</small></>}
                  </td>
                  <td><code>/c/{c.slug}</code></td>
                  <td>{formatDate(c.validFrom)} → {formatDate(c.validTo)}</td>
                  <td>
                    Path <strong>{c.defaultPurchasePath ?? "B"}</strong> · Model <strong>{c.defaultCounsellingModel ?? "1"}</strong>
                  </td>
                  <td>
                    {c.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}
                    {!c.instituteCode && (
                      <><br /><span className="badge bg-warning text-dark mt-1" title="Open this campaign and pick an institute">⚠ no institute</span></>
                    )}
                  </td>
                  <td>
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => navigate(`/b2c/campaigns/edit/${c.campaignId}`)}>Configure</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => handleDelete(c)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default CampaignPage;
