import { useEffect, useState } from "react";

export const MQT = ({ mqt, formikValues, setFormikValues }) => {
  // By default, all MQTs are checked
  const [checkedMQT, setCheckedMQT] = useState(
    mqt.map(type => type.measuredQualityTypeId)
  );
  
  // State for sequence management
  const [mqtSequences, setMqtSequences] = useState({});
  
  // State for description management
  const [mqtDescriptions, setMqtDescriptions] = useState({});

  // Initialize sequences when component mounts
  useEffect(() => {
    const initialSequences = {};
    mqt.forEach((type, index) => {
      initialSequences[type.measuredQualityTypeId] = index + 1;
    });
    setMqtSequences(initialSequences);
  }, [mqt]);

  // Generate sequence options for dropdown
  const generateSequenceOptions = (maxSequence) => {
    return Array.from({ length: maxSequence }, (_, i) => i + 1);
  };

  // Update sequence for a specific MQT
  const updateMQTSequence = (mqtId, newSequence) => {
    setMqtSequences(prev => ({
      ...prev,
      [mqtId]: parseInt(newSequence)
    }));
  };

  // Update description for a specific MQT
  const updateMQTDescription = (mqtId, description) => {
    setMqtDescriptions(prev => ({
      ...prev,
      [mqtId]: description
    }));
  };

  // When checkedMQT, sequences, or descriptions change, update options in formikValues
  useEffect(() => {
    const selectedMQTs = mqt
      .filter(type => checkedMQT.includes(type.measuredQualityTypeId))
      .map(type => ({
        ...type,
        sequence: mqtSequences[type.measuredQualityTypeId] || 1,
        description: mqtDescriptions[type.measuredQualityTypeId] || ""
      }))
      .sort((a, b) => a.sequence - b.sequence);
      
    const options = selectedMQTs.map(type => ({
      optionText: type.measuredQualityTypeName,
      description: type.description,
      correct: false,
      sequence: type.sequence,
    }));
    
    setFormikValues(v => ({
      ...v,
      questionOptions: options,
    }));
    // eslint-disable-next-line
  }, [checkedMQT, mqtSequences, mqtDescriptions, mqt]);

  return (
    <div className="mb-3">
      <label className="fw-bold mb-2">Select Measured Quality Types as Options:</label>
      <div>
        {mqt.map((type, index) => (
          <div key={type.measuredQualityTypeId} className="d-flex align-items-center gap-2 mb-3">
            {/* Sequence Dropdown */}
            <select
              className="form-select form-select-sm"
              style={{ width: "80px" }}
              value={mqtSequences[type.measuredQualityTypeId] || (index + 1)}
              onChange={(e) => updateMQTSequence(type.measuredQualityTypeId, e.target.value)}
              disabled={!checkedMQT.includes(type.measuredQualityTypeId)}
            >
              {generateSequenceOptions(mqt.length).map(seq => (
                <option key={seq} value={seq}>{seq}</option>
              ))}
            </select>
            
            {/* Checkbox and Label */}
            <div className="form-check" style={{ minWidth: "200px" }}>
              <input
                className="form-check-input"
                type="checkbox"
                checked={checkedMQT.includes(type.measuredQualityTypeId)}
                onChange={() => {
                  setCheckedMQT(checked =>
                    checked.includes(type.measuredQualityTypeId)
                      ? checked.filter(id => id !== type.measuredQualityTypeId)
                      : [...checked, type.measuredQualityTypeId]
                  );
                }}
                id={`mqt-option-${type.measuredQualityTypeId}`}
              />
              <label
                className="form-check-label fw-medium"
                htmlFor={`mqt-option-${type.measuredQualityTypeId}`}
              >
                {type.measuredQualityTypeName}
              </label>
            </div>
            
            {/* Description Textarea */}
            <textarea
              className="form-control form-control-sm"
              style={{ height: "38px", resize: "none" }}
              placeholder={`Description for ${type.measuredQualityTypeName} (optional)`}
              value={mqtDescriptions[type.measuredQualityTypeId] || ""}
              onChange={(e) => updateMQTDescription(type.measuredQualityTypeId, e.target.value)}
              disabled={!checkedMQT.includes(type.measuredQualityTypeId)}
              rows={1}
            />
          </div>
        ))}
      </div>
    </div>
  );
};