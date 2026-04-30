import React, { useEffect, useState } from "react";
import { MDBDataTableV5 } from "mdbreact";
import { Link } from "react-router-dom";
import { ReadQuestionaireDataList, DeleteQuestionaire } from "../../API/Create_Questionaire_APIs";
import { MdDelete } from "react-icons/md";
import QuestionnaireRecycleBinModal from "./QuestionnaireRecycleBinModal";
import PageHeader from "../../../../components/PageHeader";

const QuestionaireListPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  
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

  const handleSoftDelete = async (id: number, name: string) => {
    if (!window.confirm(`Move "${name}" to Recycle Bin?`)) return;
    try {
      await DeleteQuestionaire(String(id));
      fetchData();
    } catch (error) {
      console.error("Error deleting questionnaire:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await ReadQuestionaireDataList();
      const data = response.data || [];

      const formattedRows = data.map((item: any) => ({
        id: item.questionnaireId,
        name: item.name || "-",
        modeId: item.modeId === 0 ? "Online" : "Offline",
        type: item.type === true ? "Bet Assessment" : "General",
        isFree: item.isFree === true ? "Free" : "Paid",
        actions: (
          <div className="d-flex gap-2">
            <Link
              to={`/questionare/edit/${item.questionnaireId}`}
              className="btn btn-sm btn-light-primary"
            >
              Edit
            </Link>
            <button
              className="btn btn-sm btn-light-danger"
              onClick={() => handleSoftDelete(item.questionnaireId, item.name || `ID: ${item.questionnaireId}`)}
            >
              <MdDelete size={14} />
            </button>
          </div>
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
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-journals" />}
        title="Questionnaires"
        subtitle={<><strong>{datatable.rows.length}</strong> questionnaires</>}
        actions={[
          {
            label: "Recycle Bin",
            iconClass: "bi-trash",
            onClick: () => setShowRecycleBin(true),
            variant: "danger",
          },
          {
            label: "Create Questionnaire",
            iconClass: "bi-plus-lg",
            href: "/questionare/create",
            variant: "primary",
          },
        ]}
      />
      <div className="card card-xxl-stretch mb-5 mb-xl-8">
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
        <QuestionnaireRecycleBinModal
          show={showRecycleBin}
          onHide={() => setShowRecycleBin(false)}
          onRestoreComplete={() => fetchData()}
        />
      </div>
    </div>
  );
};

export default QuestionaireListPage;