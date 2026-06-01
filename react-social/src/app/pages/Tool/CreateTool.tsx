import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "react-query";
import { useTools, lookupKeys } from "../../lib/queries/lookups";
import { ToolTable } from "./components";
import PageHeader from "../../components/PageHeader";

const ToolPage = () => {
  const { data: toolsData = [], isLoading: loading } = useTools<any>();
  const queryClient = useQueryClient();
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();

  useEffect(() => {
    if (pageLoading[0] === "true") {
      queryClient.invalidateQueries(lookupKeys.tools);
      setPageLoading(["false"]);
    }
  }, [pageLoading, queryClient]);


  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-wrench-adjustable" />}
        title="Tools"
        subtitle={
          loading ? (
            "Loading..."
          ) : (
            <>
              <strong>{toolsData.length}</strong> tools
            </>
          )
        }
        actions={[
          {
            label: "Add Tool",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/tools/create"),
            variant: "primary",
          },
        ]}
      />

      {loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "48px", textAlign: "center" }}>
          <div className="spinner-border" style={{ color: "#0ea5e9" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3" style={{ color: "#6b7280" }}>Loading tools...</p>
        </div>
      )}

      {!loading && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <div style={{ padding: "16px" }}>
            <ToolTable
              data={toolsData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolPage;
