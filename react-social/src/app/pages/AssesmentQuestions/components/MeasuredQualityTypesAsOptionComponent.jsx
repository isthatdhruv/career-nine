import { useEffect, useState } from "react";

export const MQT = ({ mqt, formikValues, setFormikValues }) => {
  // By default, all MQTs are checked
  const [checkedMQT, setCheckedMQT] = useState(
    mqt.map(type => type.measuredQualityTypeId)
  );

  // When checkedMQT changes, update options in formikValues
  useEffect(() => {
    const options = mqt
      .filter(type => checkedMQT.includes(type.measuredQualityTypeId))
      .map(type => ({
        optionText: type.measuredQualityTypeName,
        correct: false,
      }));
    setFormikValues(v => ({
      ...v,
      questionOptions: options,
    }));
    // eslint-disable-next-line
  }, [checkedMQT, mqt]);

  return (
    <div className="mb-3">
      <label className="fw-bold mb-2">Select Measured Quality Types as Options:</label>
      <div>
        {mqt.map(type => (
          <div key={type.measuredQualityTypeId} className="form-check mb-2">
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
              className="form-check-label"
              htmlFor={`mqt-option-${type.measuredQualityTypeId}`}
            >
              {type.measuredQualityTypeName}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};