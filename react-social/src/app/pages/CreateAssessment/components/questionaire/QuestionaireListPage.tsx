import React, { useEffect, useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { Link } from "react-router-dom";
import { ReadQuestionaireDataList } from "../../API/Create_Questionaire_APIs";

const QuestionaireListPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  // This state variable 'questionaireList' holds the raw data
  const [questionaireList, setQuestionaireList] = useState<any[]>([]);

  const [datatable, setDatatable] = useState({
    columns: [
      {
        label: "ID",
        field: "id",
        width: 80,
      },
      {
        label: "Name",
        field: "name",
        width: 200,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Mode",
        field: "modeId",
        width: 100,
      },
      {
        label: "Category",
        field: "type",
        width: 120,
      },
      {
        label: "Pricing",
        field: "isFree",
        width: 100,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],
    rows: [] as any[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await ReadQuestionaireDataList();
      const data = response.data || [];
      console.log("Fetched questionnaire data:", data);
      
      setQuestionaireList(data);

      const formattedRows = data.map((item: any) => ({
        id: item.questionnaireId,
        name: item.name || "-",
        tool: item.tool?.toolName || "-",
        modeId: item.modeId === 0 ? "Online" : "Offline",
        type: item.type === true ? "Bet Assessment" : "General",
        isFree: item.isFree === true ? "Free" : "Paid",
        price: item.price || 0,
        actions: (
          <Link
            to={`/questionare/edit/${item.questionnaireId}`}
            className="btn btn-sm btn-light-primary"
          >
            Edit
          </Link>
        ),
      }));

      setDatatable((prev) => ({
        ...prev,
        rows: formattedRows,
      }));
    } catch (error) {
      console.error("Error fetching questionaire list:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card card-xxl-stretch mb-5 mb-xl-8">
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Questionaires</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            List of all created questionaires
          </span>
        </h3>
        <div className="card-toolbar">
          <Link to="/questionare/create" className="btn btn-sm btn-primary">
            Create Questionaire
          </Link>
        </div>
      </div>
      <div className="card-body py-3">
        {loading ? (
          <div className="text-center py-5">Loading...</div>
        ) : (
          <MDBDataTableV5
            hover
            entriesOptions={[5, 10, 20]}
            entries={10}
            pagesAmount={4}
            data={datatable}
            searchTop
            searchBottom={false}
          />
        )}
      </div>
    </div>
  );
};

export default QuestionaireListPage;