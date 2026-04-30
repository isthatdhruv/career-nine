import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadContactInformationData } from "./API/Contact_Person_APIs";
import ContactPersonTable from "./components/ContactPersonTable";
import PageHeader from "../../components/PageHeader";


const ContactPersonPage = () => {
  const [contactPersonData, setContactPersonData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const navigate = useNavigate();


  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadContactInformationData();
      setContactPersonData(response.data);
    } catch (error) {
      console.error("Failed to fetch contact persons:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      const fetchSections = async () => {
        setLoading(true);
        try {
          const response = await ReadContactInformationData();
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
        icon={<i className='bi bi-person-rolodex' />}
        title="Contact Person Information"
        subtitle={<><strong>{contactPersonData.length}</strong> contacts</>}
        actions={[
          {
            label: "Add Contact Person",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/contact-person/create"),
            variant: "primary",
          },
        ]}
      />

      <div className="card">
        {loading && (
          <span className="indicator-progress m-5" style={{ display: "block" }}>
            Please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        )}

        {!loading && (
          <div className="card-body pt-5">
            <ContactPersonTable
              data={contactPersonData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactPersonPage;
