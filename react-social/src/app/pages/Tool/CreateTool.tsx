import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadToolData } from "./API/Tool_APIs";
import { ToolTable } from "./components";
import PageHeader from "../../components/PageHeader";

const ToolPage = () => {
  const [toolsData, setToolsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();


  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadToolData();
      setToolsData(response.data);
    } catch (error) {
      console.error("Failed to fetch tools:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      const fetchSections = async () => {
        setLoading(true);
        try {
          const response = await ReadToolData();
          setSections(response.data);
        } catch (error) {
          console.error("Error fetching sections:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchSections();
    }, []);

  useEffect(() => {
    fetchQuestions();

    if (pageLoading[0] === "true") {
      setPageLoading(["false"]);
    }
  }, [pageLoading[0]]);


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
