import { useState, useEffect, useMemo } from "react";
import { getAllMeasuredQualityTypes } from "../API/OldDataMapping_APIs";

interface ScoreTypeMapping {
  firebaseKey: string;
  category: string;
  measuredQualityTypeId: number | null;
  measuredQualityTypeName: string;
}

interface Props {
  mappings: ScoreTypeMapping[];
  onDone: (mappings: ScoreTypeMapping[]) => void;
  onBack: () => void;
}

interface MQTOption {
  measuredQualityTypeId: number;
  measuredQualityTypeName: string;
  measuredQualityTypeDisplayName: string;
  measuredQuality: { measuredQualityName: string } | null;
}

const CATEGORIES = [
  { key: "ability", label: "Ability" },
  { key: "multipleIntelligence", label: "Multiple Intelligence" },
  { key: "personality", label: "Personality" },
];

const FIREBASE_KEYS_BY_CATEGORY: Record<string, { key: string; label: string }[]> = {
  ability: [
    { key: "analyticalThinking", label: "Analytical Thinking" },
    { key: "verbalReasoning", label: "Verbal Reasoning" },
    { key: "numericalAbility", label: "Numerical Ability" },
    { key: "spatialAwareness", label: "Spatial Awareness" },
    { key: "perceptualAccuracy", label: "Perceptual Accuracy" },
    { key: "mechanicalReasoning", label: "Mechanical Reasoning" },
    { key: "abstractReasoning", label: "Abstract Reasoning" },
    { key: "spellingAndLanguage", label: "Spelling and Language" },
    { key: "logicalReasoning", label: "Logical Reasoning" },
    { key: "attentionToDetail", label: "Attention to Detail" },
  ],
  multipleIntelligence: [
    { key: "linguistic", label: "Linguistic" },
    { key: "logicalMathematical", label: "Logical Mathematical" },
    { key: "spatial", label: "Spatial" },
    { key: "bodilyKinesthetic", label: "Bodily Kinesthetic" },
    { key: "musical", label: "Musical" },
    { key: "interpersonal", label: "Interpersonal" },
    { key: "intrapersonal", label: "Intrapersonal" },
    { key: "naturalistic", label: "Naturalistic" },
  ],
  personality: [
    { key: "R", label: "Realistic" },
    { key: "I", label: "Investigative" },
    { key: "A", label: "Artistic" },
    { key: "S", label: "Social" },
    { key: "E", label: "Enterprising" },
    { key: "C", label: "Conventional" },
  ],
};

const ScoreTypeMappingStep = ({ mappings: initialMappings, onDone, onBack }: Props) => {
  const [mqtOptions, setMqtOptions] = useState<MQTOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mappings, setMappings] = useState<ScoreTypeMapping[]>(initialMappings);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Build initial mappings from all categories if not already provided
  useEffect(() => {
    if (initialMappings.length > 0) return;

    const newMappings: ScoreTypeMapping[] = [];
    CATEGORIES.forEach((cat) => {
      const keys = FIREBASE_KEYS_BY_CATEGORY[cat.key];
      if (keys) {
        keys.forEach((k) => {
          newMappings.push({
            firebaseKey: k.key,
            category: cat.key,
            measuredQualityTypeId: null,
            measuredQualityTypeName: "",
          });
        });
      }
    });
    setMappings(newMappings);
  }, [initialMappings]);

  // Fetch MQT options on mount
  useEffect(() => {
    setLoading(true);
    getAllMeasuredQualityTypes()
      .then((res) => {
        const data: MQTOption[] = res.data || [];
        setMqtOptions(data);
        // Auto-suggest matches for unmapped keys
        setMappings((prev) =>
          prev.map((m) => {
            if (m.measuredQualityTypeId) return m;
            const match = findBestMatch(m.firebaseKey, data);
            if (match) {
              return {
                ...m,
                measuredQualityTypeId: match.measuredQualityTypeId,
                measuredQualityTypeName:
                  match.measuredQualityTypeDisplayName || match.measuredQualityTypeName,
              };
            }
            return m;
          })
        );
      })
      .catch(() => setError("Failed to load Measured Quality Types."))
      .finally(() => setLoading(false));
  }, []);

  const findBestMatch = (firebaseKey: string, options: MQTOption[]): MQTOption | null => {
    const normalised = firebaseKey.toLowerCase().replace(/([A-Z])/g, " $1").trim();
    const exact = options.find(
      (o) => {
        const name = (o.measuredQualityTypeName || "").toLowerCase();
        const display = (o.measuredQualityTypeDisplayName || "").toLowerCase();
        return name === normalised || display === normalised || name === firebaseKey.toLowerCase();
      }
    );
    if (exact) return exact;
    const contains = options.find(
      (o) => {
        const name = (o.measuredQualityTypeName || "").toLowerCase();
        const display = (o.measuredQualityTypeDisplayName || "").toLowerCase();
        return name.includes(normalised) || normalised.includes(name) ||
          display.includes(normalised) || normalised.includes(display);
      }
    );
    return contains || null;
  };

  const handleSelect = (firebaseKey: string, category: string, mqt: MQTOption) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.firebaseKey === firebaseKey && m.category === category
          ? {
              ...m,
              measuredQualityTypeId: mqt.measuredQualityTypeId,
              measuredQualityTypeName:
                mqt.measuredQualityTypeDisplayName || mqt.measuredQualityTypeName,
            }
          : m
      )
    );
    setOpenDropdown(null);
    setSearchTerms((prev) => ({ ...prev, [`${category}-${firebaseKey}`]: "" }));
  };

  const handleClear = (firebaseKey: string, category: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.firebaseKey === firebaseKey && m.category === category
          ? { ...m, measuredQualityTypeId: null, measuredQualityTypeName: "" }
          : m
      )
    );
  };

  const filteredOptions = (searchKey: string): MQTOption[] => {
    const term = (searchTerms[searchKey] || "").toLowerCase();
    if (!term) return mqtOptions;
    return mqtOptions.filter(
      (o) =>
        o.measuredQualityTypeName.toLowerCase().includes(term) ||
        (o.measuredQualityTypeDisplayName || "").toLowerCase().includes(term) ||
        (o.measuredQuality?.measuredQualityName || "").toLowerCase().includes(term)
    );
  };

  const allMapped = useMemo(
    () => mappings.length > 0 && mappings.every((m) => m.measuredQualityTypeId !== null),
    [mappings]
  );

  const unmappedCount = useMemo(
    () => mappings.filter((m) => m.measuredQualityTypeId === null).length,
    [mappings]
  );

  const getCategoryKeys = (category: string): { key: string; label: string }[] => {
    return FIREBASE_KEYS_BY_CATEGORY[category] || [];
  };

  const getMappingFor = (firebaseKey: string, category: string): ScoreTypeMapping | undefined => {
    return mappings.find((m) => m.firebaseKey === firebaseKey && m.category === category);
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="text-muted mt-3">Loading Measured Quality Types...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h4 className="fw-bold text-dark mb-1">Map Firebase Score Keys to Measured Quality Types</h4>
        <p className="text-muted fs-7">
          For each Firebase score key, select the corresponding Measured Quality Type in the new system.
          Auto-suggestions are pre-filled where a name match was found.
        </p>
      </div>

      {error && <div className="alert alert-danger py-2 mb-4">{error}</div>}

      {!allMapped && (
        <div className="alert alert-warning py-2 mb-4">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {unmappedCount} score key{unmappedCount !== 1 ? "s" : ""} still unmapped. All keys must be
          mapped before proceeding.
        </div>
      )}

      {CATEGORIES.map((cat) => {
        const keys = getCategoryKeys(cat.key);
        const categoryMappings = mappings.filter((m) => m.category === cat.key);
        const categoryMappedCount = categoryMappings.filter(
          (m) => m.measuredQualityTypeId !== null
        ).length;

        return (
          <div key={cat.key} className="card border mb-5">
            <div className="card-header bg-light d-flex align-items-center justify-content-between py-4">
              <h5 className="fw-bold mb-0">{cat.label}</h5>
              <span
                className={`badge ${
                  categoryMappedCount === keys.length ? "badge-light-success" : "badge-light-warning"
                } fs-7`}
              >
                {categoryMappedCount}/{keys.length} mapped
              </span>
            </div>
            <div className="card-body p-0">
              <table className="table table-row-bordered mb-0">
                <thead>
                  <tr className="fw-semibold text-muted bg-light">
                    <th className="ps-4 py-3" style={{ width: "40%" }}>
                      Firebase Score Key
                    </th>
                    <th className="py-3" style={{ width: "60%" }}>
                      Measured Quality Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const mapping = getMappingFor(k.key, cat.key);
                    const dropdownKey = `${cat.key}-${k.key}`;
                    const isOpen = openDropdown === dropdownKey;
                    const filtered = filteredOptions(dropdownKey);

                    return (
                      <tr key={k.key}>
                        <td className="ps-4 py-3 align-middle">
                          <code className="fs-7">{k.key}</code>
                          <span className="text-muted fs-8 d-block">{k.label}</span>
                        </td>
                        <td className="py-3 pe-4 align-middle">
                          {mapping?.measuredQualityTypeId ? (
                            <div className="d-flex align-items-center gap-2">
                              <span className="badge badge-light-success fs-7 px-3 py-2">
                                {mapping.measuredQualityTypeName}
                              </span>
                              <button
                                className="btn btn-sm btn-icon btn-light-danger"
                                onClick={() => handleClear(k.key, cat.key)}
                                title="Clear mapping"
                              >
                                <i className="bi bi-x"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-icon btn-light-primary"
                                onClick={() =>
                                  setOpenDropdown(isOpen ? null : dropdownKey)
                                }
                                title="Change mapping"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                setOpenDropdown(isOpen ? null : dropdownKey)
                              }
                            >
                              Select MQT...
                            </button>
                          )}

                          {isOpen && (
                            <div
                              className="border rounded mt-2 bg-white shadow-sm"
                              style={{ position: "relative", zIndex: 10 }}
                            >
                              <div className="p-2">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Search by name..."
                                  value={searchTerms[dropdownKey] || ""}
                                  onChange={(e) =>
                                    setSearchTerms((prev) => ({
                                      ...prev,
                                      [dropdownKey]: e.target.value,
                                    }))
                                  }
                                  autoFocus
                                />
                              </div>
                              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                {filtered.length === 0 && (
                                  <div className="text-muted text-center py-3 fs-7">
                                    No matching types found
                                  </div>
                                )}
                                {filtered.map((mqt) => (
                                  <div
                                    key={mqt.measuredQualityTypeId}
                                    className="px-3 py-2 border-top d-flex align-items-center justify-content-between"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelect(k.key, cat.key, mqt)}
                                    onMouseOver={(e) =>
                                      (e.currentTarget.style.backgroundColor = "#f5f8fa")
                                    }
                                    onMouseOut={(e) =>
                                      (e.currentTarget.style.backgroundColor = "transparent")
                                    }
                                  >
                                    <div>
                                      <span className="fw-semibold fs-7">
                                        {mqt.measuredQualityTypeDisplayName ||
                                          mqt.measuredQualityTypeName}
                                      </span>
                                      {mqt.measuredQuality && (
                                        <span className="text-muted fs-8 ms-2">
                                          ({mqt.measuredQuality.measuredQualityName})
                                        </span>
                                      )}
                                    </div>
                                    <span className="badge badge-light fs-8">
                                      ID: {mqt.measuredQualityTypeId}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="border-top p-2 text-end">
                                <button
                                  className="btn btn-sm btn-light"
                                  onClick={() => setOpenDropdown(null)}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="d-flex justify-content-between mt-6">
        <button className="btn btn-light" onClick={onBack}>
          <i className="bi bi-arrow-left me-2"></i>Back
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onDone(mappings)}
          disabled={!allMapped}
          title={!allMapped ? "All score keys must be mapped before proceeding" : ""}
        >
          Next<i className="bi bi-arrow-right ms-2"></i>
        </button>
      </div>
    </div>
  );
};

export default ScoreTypeMappingStep;
