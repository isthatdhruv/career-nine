/* eslint-disable jsx-a11y/anchor-is-valid */
import { FC } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../app/modules/auth";
import { Languages } from "./Languages";
import { toAbsoluteUrl } from "../../../helpers";

const HeaderUserMenu: FC = () => {
  const { currentUser } = useAuth();
  return (
    <div
      className="menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg menu-state-primary fw-bold py-4 fs-6 w-275px"
      data-kt-menu="true"
    >
      <div className="menu-item px-3">
        <div className="menu-content d-flex align-items-center px-3">
          <div className="symbol symbol-50px me-5">
            {currentUser?.imageUrl ? (
              <img alt={currentUser?.name || "Logo"} src={toAbsoluteUrl(currentUser.imageUrl)} />
            ) : (
              <div
                title={currentUser?.name}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0c6b5a, #084a3e)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: 0.5,
                  fontFamily:
                    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
              >
                {(() => {
                  const n = (currentUser?.name || "").trim();
                  if (!n) return "?";
                  const w = n.split(/\s+/);
                  return w.length >= 2 && w[0][0] && w[1][0]
                    ? (w[0][0] + w[1][0]).toUpperCase()
                    : n.substring(0, 2).toUpperCase();
                })()}
              </div>
            )}
          </div>

          <div className="d-flex flex-column">
            <div className="fw-bolder d-flex align-items-center fs-5">
              {currentUser?.name}
            </div>
            <a href="#" className="fw-bold text-muted text-hover-primary fs-7">
              {currentUser?.email}
            </a>
          </div>
        </div>
      </div>

      <div className="separator my-2"></div>

      <div className="menu-item px-5">
        <Link to={"/crafted/pages/profile"} className="menu-link px-5">
          My Profile
        </Link>
      </div>

      {/* My Projects — hidden per product request
      <div className="menu-item px-5">
        <a href="#" className="menu-link px-5">
          <span className="menu-text">My Projects</span>
          <span className="menu-badge">
            <span className="badge badge-light-danger badge-circle fw-bolder fs-7">
              3
            </span>
          </span>
        </a>
      </div>
      */}

      {/* My Subscription — hidden per product request
      <div
        className="menu-item px-5"
        data-kt-menu-trigger="hover"
        data-kt-menu-placement="left-start"
        data-kt-menu-flip="bottom"
      >
        <a href="#" className="menu-link px-5">
          <span className="menu-title">My Subscription</span>
          <span className="menu-arrow"></span>
        </a>

        <div className="menu-sub menu-sub-dropdown w-175px py-4">
          <div className="menu-item px-3">
            <a href="#" className="menu-link px-5">
              Referrals
            </a>
          </div>

          <div className="menu-item px-3">
            <a href="#" className="menu-link px-5">
              Billing
            </a>
          </div>

          <div className="menu-item px-3">
            <a href="#" className="menu-link px-5">
              Payments
            </a>
          </div>

          <div className="menu-item px-3">
            <a href="#" className="menu-link d-flex flex-stack px-5">
              Statements
              <i
                className="fas fa-exclamation-circle ms-2 fs-7"
                data-bs-toggle="tooltip"
                title="View your statements"
              ></i>
            </a>
          </div>

          <div className="separator my-2"></div>

          <div className="menu-item px-3">
            <div className="menu-content px-3">
              <label className="form-check form-switch form-check-custom form-check-solid">
                <input
                  className="form-check-input w-30px h-20px"
                  type="checkbox"
                  value="1"
                  defaultChecked={true}
                  name="notifications"
                />
                <span className="form-check-label text-muted fs-7">
                  Notifications
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
      */}

      {/* My Statements — hidden per product request
      <div className="menu-item px-5">
        <a href="#" className="menu-link px-5">
          My Statements
        </a>
      </div>
      */}

      <div className="separator my-2"></div>

      {/* Language switcher — hidden per product request
      <Languages />
      */}

      <div className="menu-item px-5 my-1">
        <Link to="/crafted/account/settings" className="menu-link px-5">
          Account Settings
        </Link>
      </div>

      <div className="menu-item px-5">
        <a
          onClick={() => (window.location.href = "logout")}
          className="menu-link px-5"
        >
          Sign Out
        </a>
      </div>
    </div>
  );
};

export { HeaderUserMenu };
