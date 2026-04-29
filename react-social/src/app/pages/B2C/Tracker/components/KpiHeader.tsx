interface Props {
  summary: any;
}

const fmtINR = (paise?: number) => paise == null ? "—" : `₹${(paise / 100).toLocaleString("en-IN")}`;

const Card = ({ label, value, tone }: { label: string; value: any; tone?: "navy" | "emerald" | "cyan" | "slate" }) => {
  const bg = {
    navy: "#0f172a",
    emerald: "#059669",
    cyan: "#0891b2",
    slate: "#475569",
  }[tone ?? "slate"];
  return (
    <div className="col-md-2 col-6 mb-2">
      <div style={{ background: bg, color: "white", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontSize: "0.78em", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.85 }}>{label}</div>
        <div style={{ fontSize: "1.45em", fontWeight: 700, marginTop: 4 }}>{value}</div>
      </div>
    </div>
  );
};

const KpiHeader = ({ summary }: Props) => {
  return (
    <div className="row">
      <Card label="Revenue" value={fmtINR(summary.totalRevenue)} tone="navy" />
      <Card label="Paid" value={summary.paidCount ?? 0} tone="emerald" />
      <Card label="Pending" value={summary.createdCount ?? 0} tone="slate" />
      <Card label="Refunds" value={summary.refundCount ?? 0} tone="slate" />
      <Card label="Active" value={summary.activeEntitlements ?? 0} tone="emerald" />
      <Card label="Expiring < 7d" value={summary.expiringIn7Days ?? 0} tone="cyan" />
    </div>
  );
};

export default KpiHeader;
