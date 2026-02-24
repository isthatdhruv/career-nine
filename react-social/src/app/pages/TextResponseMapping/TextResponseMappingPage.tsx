import React, { useEffect, useState } from "react";
import {
  GetTextResponses,
  MapTextResponse,
  RecalculateScores,
  GetAssessmentList,
} from "./API/TextResponseMapping_APIs";
import { matchTextToOption, matchTextToOptionsBulk } from "../AssesmentQuestions/API/Translate_APIs";

interface OptionRef {
  optionId: number;
  optionText: string;
}

interface TextResponseItem {
  assessmentAnswerId: number;
  assessmentAnswerIds: number[];
  textResponse: string;
  count: number;
  student: { userStudentId: number; userId: number } | null;
  question: {
    questionId: number;
    questionText: string;
    questionnaireQuestionId: number;
    options: OptionRef[];
  } | null;
  mappedOption: OptionRef | null;
}

interface Assessment {
  id: number;
  assessmentName: string;
}

const TextResponseMappingPage: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [textResponses, setTextResponses] = useState<TextResponseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mappingState, setMappingState] = useState<Record<number, number | "">>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<number>>(new Set());
  const [bulkAiLoading, setBulkAiLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  // Load assessments on mount
  useEffect(() => {
    GetAssessmentList()
      .then((res) => {
        setAssessments(res.data || []);
      })
      .catch((err) => console.error("Failed to load assessments:", err));
  }, []);

  // Load text responses when assessment changes
  useEffect(() => {
    if (!selectedAssessmentId) {
      setTextResponses([]);
      return;
    }
    setLoading(true);
    GetTextResponses(selectedAssessmentId)
      .then((res) => {
        const data: TextResponseItem[] = res.data || [];
        setTextResponses(data);
        // Initialize mapping state from existing mappings
        const initial: Record<number, number | ""> = {};
        for (const item of data) {
          initial[item.assessmentAnswerId] = item.mappedOption?.optionId || "";
        }
        setMappingState(initial);
      })
      .catch((err) => {
        console.error("Failed to load text responses:", err);
        setMessage({ type: "danger", text: "Failed to load text responses." });
      })
      .finally(() => setLoading(false));
  }, [selectedAssessmentId]);

  const handleMapSingle = async (assessmentAnswerId: number) => {
    const optionId = mappingState[assessmentAnswerId];
    if (!optionId) return;

    setSavingIds((prev) => new Set(prev).add(assessmentAnswerId));
    try {
      await MapTextResponse(assessmentAnswerId, optionId as number);
      // Update local state
      setTextResponses((prev) =>
        prev.map((item) => {
          if (item.assessmentAnswerId === assessmentAnswerId) {
            const opt = item.question?.options.find((o) => o.optionId === optionId);
            return { ...item, mappedOption: opt || null };
          }
          return item;
        })
      );
      setMessage({ type: "success", text: "Mapping saved successfully." });
    } catch (err) {
      console.error("Failed to map:", err);
      setMessage({ type: "danger", text: "Failed to save mapping." });
    } finally {
      setSavingIds((prev) => {
        const s = new Set(prev);
        s.delete(assessmentAnswerId);
        return s;
      });
    }
  };

  const handleAiSuggest = async (item: TextResponseItem) => {
    if (!item.question?.options?.length) return;

    setAiLoadingIds((prev) => new Set(prev).add(item.assessmentAnswerId));
    try {
      const result = await matchTextToOption(item.textResponse, item.question.options);
      if (result.matchedOptionId) {
        setMappingState((prev) => ({
          ...prev,
          [item.assessmentAnswerId]: result.matchedOptionId,
        }));
      }
      setMessage({
        type: result.matchedOptionId ? "success" : "danger",
        text: result.matchedOptionId
          ? `AI suggests: "${result.matchedOptionText}" — ${result.reason || ""}`
          : "AI could not find a reasonable match.",
      });
    } catch (err) {
      console.error("AI matching failed:", err);
      setMessage({ type: "danger", text: "AI matching failed." });
    } finally {
      setAiLoadingIds((prev) => {
        const s = new Set(prev);
        s.delete(item.assessmentAnswerId);
        return s;
      });
    }
  };

  const handleBulkAiMap = async () => {
    // Get all unmapped responses
    const unmapped = textResponses.filter(
      (item) => !mappingState[item.assessmentAnswerId] && item.question?.options?.length
    );
    if (unmapped.length === 0) {
      setMessage({ type: "danger", text: "No unmapped responses to process." });
      return;
    }

    setBulkAiLoading(true);
    try {
      const responses = unmapped.map((item) => ({
        textResponse: item.textResponse,
        options: item.question!.options,
      }));
      const result = await matchTextToOptionsBulk(responses);

      if (result.results) {
        const newState = { ...mappingState };
        for (let i = 0; i < unmapped.length; i++) {
          const match = result.results[i];
          if (match.matchedOptionId) {
            newState[unmapped[i].assessmentAnswerId] = match.matchedOptionId;
          }
        }
        setMappingState(newState);
        const matched = result.results.filter((r: any) => r.matchedOptionId).length;
        setMessage({
          type: "success",
          text: `AI mapped ${matched} of ${unmapped.length} responses. Review and save each mapping.`,
        });
      }
    } catch (err) {
      console.error("Bulk AI matching failed:", err);
      setMessage({ type: "danger", text: "Bulk AI matching failed." });
    } finally {
      setBulkAiLoading(false);
    }
  };

  const handleRecalculateScores = async () => {
    if (!selectedAssessmentId) return;
    setRecalculating(true);
    try {
      const res = await RecalculateScores(selectedAssessmentId);
      const data = res.data;
      setMessage({
        type: "success",
        text: `Scores recalculated for ${data.studentsProcessed} students.`,
      });
    } catch (err) {
      console.error("Recalculation failed:", err);
      setMessage({ type: "danger", text: "Score recalculation failed." });
    } finally {
      setRecalculating(false);
    }
  };

  const unmappedCount = textResponses.filter((item) => !item.mappedOption && !mappingState[item.assessmentAnswerId]).length;
  const totalCount = textResponses.length;

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <div className="card-title">
          <h3 className="fw-bolder m-0">Text Response Mapping</h3>
        </div>
      </div>
      <div className="card-body py-4">
        {message && (
          <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
            {message.text}
            <button type="button" className="btn-close" onClick={() => setMessage(null)}></button>
          </div>
        )}

        {/* Assessment Selector */}
        <div className="row mb-5">
          <div className="col-md-4">
            <label className="fs-6 fw-bold mb-2">Select Assessment</label>
            <select
              className="form-select form-select-solid"
              value={selectedAssessmentId || ""}
              onChange={(e) => setSelectedAssessmentId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- Select Assessment --</option>
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assessmentName}
                </option>
              ))}
            </select>
          </div>
          {selectedAssessmentId && textResponses.length > 0 && (
            <div className="col-md-8 d-flex align-items-end gap-3">
              <button
                className="btn btn-info"
                onClick={handleBulkAiMap}
                disabled={bulkAiLoading || unmappedCount === 0}
              >
                {bulkAiLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>AI Processing...</>
                ) : (
                  <>AI Auto-Map Unmapped ({unmappedCount})</>
                )}
              </button>
              <button
                className="btn btn-success"
                onClick={handleRecalculateScores}
                disabled={recalculating}
              >
                {recalculating ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span>Recalculating...</>
                ) : (
                  "Recalculate Scores"
                )}
              </button>
              <span className="badge bg-secondary fs-7 p-3">
                {totalCount} responses, {unmappedCount} unmapped
              </span>
            </div>
          )}
        </div>

        {/* Text Responses Table */}
        {loading ? (
          <div className="text-center py-10">
            <span className="spinner-border spinner-border-lg"></span>
            <p className="mt-3">Loading text responses...</p>
          </div>
        ) : !selectedAssessmentId ? (
          <div className="text-center py-10 text-muted">
            <p className="fs-5">Select an assessment to view text responses.</p>
          </div>
        ) : textResponses.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <p className="fs-5">No text responses found for this assessment.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-row-bordered table-row-gray-100 align-middle gs-0 gy-3">
              <thead>
                <tr className="fw-bolder text-muted">
                  <th className="min-w-200px">Question</th>
                  <th className="min-w-150px">Text Response</th>
                  <th className="min-w-50px">Count</th>
                  <th className="min-w-200px">Map to Option</th>
                  <th className="min-w-50px">Status</th>
                  <th className="min-w-150px text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {textResponses.map((item) => {
                  const currentMapping = mappingState[item.assessmentAnswerId];
                  const isSaved = item.mappedOption?.optionId === currentMapping;
                  const isSaving = savingIds.has(item.assessmentAnswerId);
                  const isAiLoading = aiLoadingIds.has(item.assessmentAnswerId);

                  return (
                    <tr key={item.assessmentAnswerId}>
                      <td>
                        <span className="text-dark d-block fs-7" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.question?.questionText || "N/A"}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-light-primary text-primary fs-7 p-2">
                          {item.textResponse}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary fs-7">{item.count || 1}</span>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={currentMapping || ""}
                          onChange={(e) =>
                            setMappingState((prev) => ({
                              ...prev,
                              [item.assessmentAnswerId]: e.target.value ? Number(e.target.value) : "",
                            }))
                          }
                        >
                          <option value="">-- Select Option --</option>
                          {item.question?.options.map((opt) => (
                            <option key={opt.optionId} value={opt.optionId}>
                              {opt.optionText}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {item.mappedOption ? (
                          <span className="badge bg-success">Mapped</span>
                        ) : currentMapping ? (
                          <span className="badge bg-warning text-dark">Unsaved</span>
                        ) : (
                          <span className="badge bg-danger">Unmapped</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-light-info me-2"
                          onClick={() => handleAiSuggest(item)}
                          disabled={isAiLoading || !item.question?.options?.length}
                          title="AI Suggest"
                        >
                          {isAiLoading ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : (
                            "AI Suggest"
                          )}
                        </button>
                        <button
                          className="btn btn-sm btn-light-success"
                          onClick={() => handleMapSingle(item.assessmentAnswerId)}
                          disabled={!currentMapping || isSaving || isSaved}
                        >
                          {isSaving ? (
                            <span className="spinner-border spinner-border-sm"></span>
                          ) : isSaved ? (
                            "Saved"
                          ) : (
                            "Save"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextResponseMappingPage;
