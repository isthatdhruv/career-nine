/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import { KTSVG, toAbsoluteUrl } from "../../../../_metronic/helpers";

type Props = {
  className?: string;
  rows?: any[][];
  maxPreviewRows?: number;
};

const StudentTable: React.FC<Props> = ({ className, rows, maxPreviewRows = 200 }) => {
  // When rows exist (from uploaded Excel), show them using the same card/table styling
  if (rows && rows.length) {
    const header = rows[0] as any[];
    const bodyRows = rows.slice(1, 1 + maxPreviewRows);
    return (
      <div className={`card ${className || ""}`}>
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold fs-3 mb-1">Uploaded Students</span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              Showing preview ({bodyRows.length} rows)
            </span>
          </h3>
        </div>

        <div className="card-body py-3">
          <div className="table-responsive">
            <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
              <thead>
                <tr className="fw-bold text-muted">
                  <th className="w-25px">
                    <div className="form-check form-check-sm form-check-custom form-check-solid">
                      <input className="form-check-input" type="checkbox" />
                    </div>
                  </th>

                  {header.map((h, i) => (
                    <th key={i} className="min-w-120px">
                      {String(h || `Column ${i + 1}`)}
                    </th>
                  ))}

                  {/* Keep Actions header so per-row action buttons remain */}
                  <th className="min-w-100px text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((r, ri) => (
                  <tr key={ri}>
                    <td>
                      <div className="form-check form-check-sm form-check-custom form-check-solid">
                        <input className="form-check-input" type="checkbox" />
                      </div>
                    </td>

                    {header.map((_, ci) => (
                      <td key={ci}>{String((r && r[ci]) ?? "")}</td>
                    ))}

                    {/* Preserve action buttons like the default (non-breaking placeholders) */}
                    <td>
                      <div className="d-flex justify-content-end flex-shrink-0">
                        <a href="#" className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1">
                          <KTSVG path="/media/icons/duotune/general/gen019.svg" className="svg-icon-3" />
                        </a>
                        <a href="#" className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1">
                          <KTSVG path="/media/icons/duotune/art/art005.svg" className="svg-icon-3" />
                        </a>
                        <a href="#" className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm">
                          <KTSVG path="/media/icons/duotune/general/gen027.svg" className="svg-icon-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length - 1 > maxPreviewRows && (
            <div className="mt-2 text-muted">Showing first {maxPreviewRows} rows</div>
          )}
        </div>
      </div>
    );
  }

  // default existing UI when no rows (unchanged)
  return (
    <div className={`card ${className}`}>
      {/* begin::Header */}
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">
            Members Statistics
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Over 500 members
          </span>
        </h3>
        <div
          className="card-toolbar"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          data-bs-trigger="hover"
          title="Click to add a user"
        >
          <a
            href="#"
            className="btn btn-sm btn-light-primary"
            // data-bs-toggle='modal'
            // data-bs-target='#kt_modal_invite_friends'
          >
            <KTSVG
              path="media/icons/duotune/arrows/arr075.svg"
              className="svg-icon-3"
            />
            New Member
          </a>
        </div>
      </div>
      {/* end::Header */}
      {/* begin::Body */}
      <div className="card-body py-3">
        {/* begin::Table container */}
        <div className="table-responsive">
          {/* begin::Table */}
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            {/* begin::Table head */}
            <thead>
              <tr className="fw-bold text-muted">
                <th className="w-25px">
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      value="1"
                      data-kt-check="true"
                      data-kt-check-target=".widget-9-check"
                    />
                  </div>
                </th>
                <th className="min-w-150px">Authors</th>
                <th className="min-w-140px">Company</th>
                <th className="min-w-120px">Progress</th>
                <th className="min-w-100px text-end">Actions</th>
              </tr>
            </thead>
            {/* end::Table head */}
            {/* begin::Table body */}
            <tbody>
              <tr>
                <td>
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input widget-9-check"
                      type="checkbox"
                      value="1"
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-45px me-5">
                      <img
                        src={toAbsoluteUrl("/media/avatars/300-14.jpg")}
                        alt=""
                      />
                    </div>
                    <div className="d-flex justify-content-start flex-column">
                      <a
                        href="#"
                        className="text-dark fw-bold text-hover-primary fs-6"
                      >
                        Ana Simmons
                      </a>
                      <span className="text-muted fw-semibold text-muted d-block fs-7">
                        HTML, JS, ReactJS
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <a
                    href="#"
                    className="text-dark fw-bold text-hover-primary d-block fs-6"
                  >
                    Intertico
                  </a>
                  <span className="text-muted fw-semibold text-muted d-block fs-7">
                    Web, UI/UX Design
                  </span>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-column w-100 me-2">
                    <div className="d-flex flex-stack mb-2">
                      <span className="text-muted me-2 fs-7 fw-semibold">
                        50%
                      </span>
                    </div>
                    <div className="progress h-6px w-100">
                      <div
                        className="progress-bar bg-primary"
                        role="progressbar"
                        style={{ width: "50%" }}
                      ></div>
                    </div>
                  </div>
                </td>
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
              <tr>
                <td>
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input widget-9-check"
                      type="checkbox"
                      value="1"
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-45px me-5">
                      <img
                        src={toAbsoluteUrl("/media/avatars/300-2.jpg")}
                        alt=""
                      />
                    </div>
                    <div className="d-flex justify-content-start flex-column">
                      <a
                        href="#"
                        className="text-dark fw-bold text-hover-primary fs-6"
                      >
                        Jessie Clarcson
                      </a>
                      <span className="text-muted fw-semibold text-muted d-block fs-7">
                        C#, ASP.NET, MS SQL
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <a
                    href="#"
                    className="text-dark fw-bold text-hover-primary d-block fs-6"
                  >
                    Agoda
                  </a>
                  <span className="text-muted fw-semibold text-muted d-block fs-7">
                    Houses &amp; Hotels
                  </span>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-column w-100 me-2">
                    <div className="d-flex flex-stack mb-2">
                      <span className="text-muted me-2 fs-7 fw-semibold">
                        70%
                      </span>
                    </div>
                    <div className="progress h-6px w-100">
                      <div
                        className="progress-bar bg-danger"
                        role="progressbar"
                        style={{ width: "70%" }}
                      ></div>
                    </div>
                  </div>
                </td>
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
              <tr>
                <td>
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input widget-9-check"
                      type="checkbox"
                      value="1"
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-45px me-5">
                      <img
                        src={toAbsoluteUrl("/media/avatars/300-5.jpg")}
                        alt=""
                      />
                    </div>
                    <div className="d-flex justify-content-start flex-column">
                      <a
                        href="#"
                        className="text-dark fw-bold text-hover-primary fs-6"
                      >
                        Lebron Wayde
                      </a>
                      <span className="text-muted fw-semibold text-muted d-block fs-7">
                        PHP, Laravel, VueJS
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <a
                    href="#"
                    className="text-dark fw-bold text-hover-primary d-block fs-6"
                  >
                    RoadGee
                  </a>
                  <span className="text-muted fw-semibold text-muted d-block fs-7">
                    Transportation
                  </span>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-column w-100 me-2">
                    <div className="d-flex flex-stack mb-2">
                      <span className="text-muted me-2 fs-7 fw-semibold">
                        60%
                      </span>
                    </div>
                    <div className="progress h-6px w-100">
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: "60%" }}
                      ></div>
                    </div>
                  </div>
                </td>
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
              <tr>
                <td>
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input widget-9-check"
                      type="checkbox"
                      value="1"
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-45px me-5">
                      <img
                        src={toAbsoluteUrl("/media/avatars/300-20.jpg")}
                        alt=""
                      />
                    </div>
                    <div className="d-flex justify-content-start flex-column">
                      <a
                        href="#"
                        className="text-dark fw-bold text-hover-primary fs-6"
                      >
                        Natali Goodwin
                      </a>
                      <span className="text-muted fw-semibold text-muted d-block fs-7">
                        Python, PostgreSQL, ReactJS
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <a
                    href="#"
                    className="text-dark fw-bold text-hover-primary d-block fs-6"
                  >
                    The Hill
                  </a>
                  <span className="text-muted fw-semibold text-muted d-block fs-7">
                    Insurance
                  </span>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-column w-100 me-2">
                    <div className="d-flex flex-stack mb-2">
                      <span className="text-muted me-2 fs-7 fw-semibold">
                        50%
                      </span>
                    </div>
                    <div className="progress h-6px w-100">
                      <div
                        className="progress-bar bg-warning"
                        role="progressbar"
                        style={{ width: "50%" }}
                      ></div>
                    </div>
                  </div>
                </td>
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
              <tr>
                <td>
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input widget-9-check"
                      type="checkbox"
                      value="1"
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex align-items-center">
                    <div className="symbol symbol-45px me-5">
                      <img
                        src={toAbsoluteUrl("/media/avatars/300-23.jpg")}
                        alt=""
                      />
                    </div>
                    <div className="d-flex justify-content-start flex-column">
                      <a
                        href="#"
                        className="text-dark fw-bold text-hover-primary fs-6"
                      >
                        Kevin Leonard
                      </a>
                      <span className="text-muted fw-semibold text-muted d-block fs-7">
                        HTML, JS, ReactJS
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <a
                    href="#"
                    className="text-dark fw-bold text-hover-primary d-block fs-6"
                  >
                    RoadGee
                  </a>
                  <span className="text-muted fw-semibold text-muted d-block fs-7">
                    Art Director
                  </span>
                </td>
                <td className="text-end">
                  <div className="d-flex flex-column w-100 me-2">
                    <div className="d-flex flex-stack mb-2">
                      <span className="text-muted me-2 fs-7 fw-semibold">
                        90%
                      </span>
                    </div>
                    <div className="progress h-6px w-100">
                      <div
                        className="progress-bar bg-info"
                        role="progressbar"
                        style={{ width: "90%" }}
                      ></div>
                    </div>
                  </div>
                </td>
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
            </tbody>
            {/* end::Table body */}
          </table>
          {/* end::Table */}
        </div>
        {/* end::Table container */}
      </div>
      {/* begin::Body */}
    </div>
  );
};

export { StudentTable };
