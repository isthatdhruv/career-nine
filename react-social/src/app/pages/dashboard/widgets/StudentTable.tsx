/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useMemo } from "react";
import { KTSVG } from "../../../../_metronic/helpers";

type Props = {
  className?: string;
  rows?: any[][];
  maxPreviewRows?: number;
  onUpdate?: (updatedRows: any[][]) => void;
};

const StudentTable: React.FC<Props> = ({
  className,
  rows,
  maxPreviewRows = 200,
  onUpdate,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );

  // 1. Prepare data unconditionally (always run hooks)
  const header = rows && rows.length > 0 ? (rows[0] as any[]) : [];
  const allBodyRows = rows && rows.length > 0 ? rows.slice(1) : [];

  const indexedBodyRows = useMemo(() => {
    return allBodyRows.map((r, i) => ({ data: r, originalIndex: i }));
  }, [allBodyRows]);

  const finalFiltered = useMemo(() => {
    let result = indexedBodyRows;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((item) =>
        item.data.some((cell) => String(cell).toLowerCase().includes(lower))
      );
    }
    return result.slice(0, maxPreviewRows);
  }, [indexedBodyRows, searchTerm, maxPreviewRows]);

  const allSelected =
    finalFiltered.length > 0 &&
    finalFiltered.every((item) => selectedIndices.has(item.originalIndex));

  const isIndeterminate =
    finalFiltered.some((item) => selectedIndices.has(item.originalIndex)) &&
    !allSelected;

  const toggleAll = () => {
    const newSet = new Set(selectedIndices);
    if (allSelected) {
      // Uncheck all VISIBLE
      finalFiltered.forEach((item) => newSet.delete(item.originalIndex));
    } else {
      // Check all VISIBLE
      finalFiltered.forEach((item) => newSet.add(item.originalIndex));
    }
    setSelectedIndices(newSet);
  };

  const toggleRow = (originalIndex: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(originalIndex)) {
      newSet.delete(originalIndex);
    } else {
      newSet.add(originalIndex);
    }
    setSelectedIndices(newSet);
  };

  const handleCellChange = (
    originalIndex: number,
    colIndex: number,
    value: string
  ) => {
    if (!rows || !onUpdate) return;
    // Create shallow copy of rows
    const newRows = [...rows];
    // Copy the specific row (remember originalIndex is 0-based index of BODY rows, so it maps to rows[originalIndex + 1])
    const targetRowIndex = originalIndex + 1;
    newRows[targetRowIndex] = [...newRows[targetRowIndex]];
    // Update cell
    newRows[targetRowIndex][colIndex] = value;
    onUpdate(newRows);
  };

  // 2. Conditional Rendering AFTER hooks
  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <div className={`card ${className || ""}`}>
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">
            Uploaded Students
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Showing {finalFiltered.length} matching rows
          </span>
        </h3>
        <div className="card-toolbar">
          {/* Search Bar */}
          <div className="d-flex align-items-center position-relative my-1">
            <span className="svg-icon svg-icon-1 position-absolute ms-4">
              <KTSVG
                path="/media/icons/duotune/general/gen021.svg"
                className="svg-icon-1"
              />
            </span>
            <input
              type="text"
              className="form-control form-control-solid w-250px ps-14"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card-body py-3">
        <div className="table-responsive">
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
              <tr className="fw-bold text-muted">
                <th className="w-25px">
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleAll}
                    />
                  </div>
                </th>

                {header.map((h, i) => (
                  <th key={i} className="min-w-120px">
                    {String(h || `Column ${i + 1}`)}
                  </th>
                ))}

                <th className="min-w-100px text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {finalFiltered.map((item) => (
                <tr key={item.originalIndex}>
                  <td>
                    <div className="form-check form-check-sm form-check-custom form-check-solid">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={selectedIndices.has(item.originalIndex)}
                        onChange={() => toggleRow(item.originalIndex)}
                      />
                    </div>
                  </td>

                  {item.data.map((cell, ci) => (
                    <td key={ci}>
                      <input
                        type="text"
                        className="form-control form-control-solid form-control-sm"
                        value={String(cell ?? "")}
                        onChange={(e) =>
                          handleCellChange(item.originalIndex, ci, e.target.value)
                        }
                      />
                    </td>
                  ))}

                  <td>
                    <div className="d-flex justify-content-end flex-shrink-0">
                      <a
                        href="#"
                        className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                      >
                        <KTSVG
                          path="/media/icons/duotune/general/gen019.svg"
                          className="svg-icon-3"
                        />
                      </a>
                      <a
                        href="#"
                        className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                      >
                        <KTSVG
                          path="/media/icons/duotune/art/art005.svg"
                          className="svg-icon-3"
                        />
                      </a>
                      <a
                        href="#"
                        className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                      >
                        <KTSVG
                          path="/media/icons/duotune/general/gen027.svg"
                          className="svg-icon-3"
                        />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {finalFiltered.length === 0 && (
                <tr>
                  <td
                    colSpan={header.length + 2}
                    className="text-center text-muted"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows && rows.length - 1 > maxPreviewRows && (
          <div className="mt-2 text-muted">
            Showing first {maxPreviewRows} rows
          </div>
        )}
      </div>
    </div>
  );
};

export { StudentTable };
