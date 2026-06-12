import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useRef, useState } from "react";
import { Modal, Form } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateCollegeData, UploadInstituteLogo } from "../API/College_APIs";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import InstituteSessionDetailsPanel, {
  InstituteSessionDetailsPanelHandle,
} from "./InstituteSessionDetailsPanel";
import InstituteCatalogPicker from "./InstituteCatalogPicker";

type WizardStep = 1 | 2 | 3;

interface InstituteRow {
  id?: string | number;
  instituteName?: string;
  instituteAddress?: string;
  instituteCode?: string;
  maxStudents?: string | number;
  maxContactPersons?: string | number;
  display?: any;
  [k: string]: any;
}

interface Props {
  show: boolean;
  onHide: () => void;
  setPageLoading: (val: any) => void;
  /** When provided, the wizard opens in edit mode and unlocks all three steps. */
  existing?: InstituteRow | null;
}

const validationSchema = Yup.object().shape({
  instituteName: Yup.string().required("Institute Name is required"),
  instituteAddress: Yup.string().required("Institute Address is required"),
  instituteCode: Yup.string().required("Institute Code is required"),
  maxStudents: Yup.string().required("Maximum Students is required"),
  maxContactPersons: Yup.string().required("Maximum Contact Persons is required"),
});

const MAX_LOGO_SIZE = 1 * 1024 * 1024;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Basic Info",
  2: "Add Session Details",
  3: "Map Assessments",
};

const InstituteWizardModal = ({ show, onHide, setPageLoading, existing }: Props) => {
  const isEdit = !!existing;
  const [step, setStep] = useState<WizardStep>(1);
  const [savedStep1, setSavedStep1] = useState(false);
  const [savedStep2, setSavedStep2] = useState(false);
  const [instituteCode, setInstituteCode] = useState<string>("");
  const [instituteName, setInstituteName] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const sessionPanelRef = useRef<InstituteSessionDetailsPanelHandle>(null);

  const initialValues = {
    instituteName: existing?.instituteName ?? "",
    instituteAddress: existing?.instituteAddress ?? "",
    instituteCode: existing?.instituteCode ?? "",
    maxStudents: existing?.maxStudents != null ? String(existing.maxStudents) : "",
    maxContactPersons:
      existing?.maxContactPersons != null ? String(existing.maxContactPersons) : "",
    display: 1,
    isWhitelabel: existing?.isWhitelabel ?? false,
  };

  // Reset whenever the modal is opened or the target institute changes.
  useEffect(() => {
    if (show) {
      setStep(1);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoError(null);
      if (isEdit && existing?.instituteCode) {
        setSavedStep1(true);
        setSavedStep2(true);
        setInstituteCode(String(existing.instituteCode));
        setInstituteName(existing.instituteName || "");
      } else {
        setSavedStep1(false);
        setSavedStep2(false);
        setInstituteCode("");
        setInstituteName("");
      }
    }
  }, [show, isEdit, existing?.instituteCode, existing?.instituteName]);

  // Full data URL (incl. "data:image/png;base64," prefix) — the backend detects the
  // content type from the prefix and rejects anything that isn't PNG/JPEG.
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setLogoError(null);
    // PNG/JPG only — the logo is reused in emails (Outlook won't render WebP) and reports.
    if (file && !["image/png", "image/jpeg"].includes(file.type)) {
      setLogoError("Logo must be a PNG or JPG/JPEG image");
      setLogoFile(null);
      setLogoPreview(null);
      e.target.value = "";
      return;
    }
    if (file && file.size > MAX_LOGO_SIZE) {
      setLogoError("Logo must be under 1 MB");
      setLogoFile(null);
      setLogoPreview(null);
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const payload: any = { ...values };
        // Whitelabel logo → upload to DO Spaces, persist the returned CDN URL on logoUrl
        // (replaces the legacy in-DB blob). Carry the existing URL forward when unchanged.
        if (logoFile) {
          const dataUrl = await fileToDataUrl(logoFile);
          const up = await UploadInstituteLogo(dataUrl, values.instituteCode, existing?.logoUrl);
          payload.logoUrl = up?.data?.url ?? existing?.logoUrl ?? null;
        } else if (existing?.logoUrl) {
          payload.logoUrl = existing.logoUrl;
        }
        const res = await UpdateCollegeData(payload);
        showSuccessToast("Basic info saved");
        // institute_code is an IDENTITY PK — the server may assign/override it on
        // create. Adopt the saved entity's code so Steps 2 & 3 target the real PK
        // instead of the value the admin typed.
        const saved = res?.data;
        const serverCode =
          saved && saved.instituteCode != null ? String(saved.instituteCode) : String(values.instituteCode);
        setInstituteCode(serverCode);
        setInstituteName(saved?.instituteName || values.instituteName);
        setSavedStep1(true);
        setPageLoading(["true"]);
        setStep(2);
      } catch (err: any) {
        console.error("Failed to save institute basic info:", err);
        const serverMsg = err?.response?.data?.error;
        showErrorToast(serverMsg || "Failed to save basic info. Please try again.");
      } finally {
        setLoading(false);
      }
    },
  });

  const handleStep2SaveAndContinue = async () => {
    if (!sessionPanelRef.current) return;
    const ok = await sessionPanelRef.current.save();
    if (!ok) {
      showErrorToast(
        "Add at least one session for this institute before continuing."
      );
      return;
    }
    setSavedStep2(true);
    setPageLoading(["true"]);
    setStep(3);
  };

  const handleFinish = () => {
    setPageLoading(["true"]);
    onHide();
  };

  const canClickStep = (target: WizardStep): boolean => {
    if (target === 1) return true;
    if (target === 2) return savedStep1;
    if (target === 3) return savedStep1 && savedStep2;
    return false;
  };

  const goToStep = (target: WizardStep) => {
    if (canClickStep(target)) setStep(target);
  };

  const Stepper = (
    <div className="d-flex align-items-center gap-2 mb-4">
      {([1, 2, 3] as WizardStep[]).map((n, idx) => {
        const active = step === n;
        const enabled = canClickStep(n);
        const completed =
          (n === 1 && savedStep1) || (n === 2 && savedStep2) || (n === 3 && false);
        return (
          <div key={n} className="d-flex align-items-center" style={{ flex: 1 }}>
            <button
              type="button"
              onClick={() => goToStep(n)}
              disabled={!enabled}
              className={clsx(
                "btn btn-sm d-flex align-items-center gap-2 flex-grow-1",
                active
                  ? "btn-primary"
                  : completed
                  ? "btn-success"
                  : "btn-light"
              )}
              style={{ borderRadius: 12 }}
            >
              <span
                className="badge bg-white text-dark"
                style={{ minWidth: 22, borderRadius: 11 }}
              >
                {n}
              </span>
              <span className="fw-semibold">{STEP_LABELS[n]}</span>
            </button>
            {idx < 2 && (
              <span
                className="mx-2 flex-grow-0"
                style={{ height: 2, width: 16, background: "#dee2e6" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      aria-labelledby="institute-wizard-title"
      backdrop="static"
    >
      <Modal.Header>
        <Modal.Title id="institute-wizard-title">
          <h2 className="mb-0">
            {isEdit ? "Manage Institute" : "Add Institute"}
          </h2>
          {instituteName && (
            <small className="text-muted">{instituteName}</small>
          )}
        </Modal.Title>
        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={onHide}
          style={{ cursor: "pointer" }}
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse
          />
        </div>
      </Modal.Header>

      <Modal.Body>
        {Stepper}

        {step === 1 && (
          <form
            id="institute-wizard-step1"
            className="form w-100"
            onSubmit={formik.handleSubmit}
          >
            <div className="fv-row mb-5">
              <label className="required fs-6 fw-bold mb-2">Institute Name :</label>
              <input
                placeholder="Enter Institute Name"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("instituteName")}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger":
                    formik.touched.instituteName && !!formik.errors.instituteName,
                  "is-valid":
                    formik.touched.instituteName && !formik.errors.instituteName,
                })}
              />
              {formik.touched.instituteName && formik.errors.instituteName && (
                <div className="text-danger small mt-1">
                  {formik.errors.instituteName}
                </div>
              )}
            </div>

            <div className="fv-row mb-5">
              <label className="required fs-6 fw-bold mb-2">Institute Code :</label>
              <input
                placeholder="Enter Institute Code"
                type="text"
                autoComplete="off"
                disabled={isEdit}
                {...formik.getFieldProps("instituteCode")}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger":
                    formik.touched.instituteCode && !!formik.errors.instituteCode,
                  "is-valid":
                    formik.touched.instituteCode && !formik.errors.instituteCode,
                })}
              />
              {formik.touched.instituteCode && formik.errors.instituteCode && (
                <div className="text-danger small mt-1">
                  {formik.errors.instituteCode}
                </div>
              )}
            </div>

            <div className="fv-row mb-5">
              <label className="required fs-6 fw-bold mb-2">Institute Address :</label>
              <input
                placeholder="Enter Institute Address"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("instituteAddress")}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger":
                    formik.touched.instituteAddress && !!formik.errors.instituteAddress,
                  "is-valid":
                    formik.touched.instituteAddress && !formik.errors.instituteAddress,
                })}
              />
              {formik.touched.instituteAddress && formik.errors.instituteAddress && (
                <div className="text-danger small mt-1">
                  {formik.errors.instituteAddress}
                </div>
              )}
            </div>

            <div className="fv-row mb-5">
              <label className="required fs-6 fw-bold mb-2">Maximum Students :</label>
              <input
                placeholder="Enter Maximum Students"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("maxStudents")}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger":
                    formik.touched.maxStudents && !!formik.errors.maxStudents,
                  "is-valid":
                    formik.touched.maxStudents && !formik.errors.maxStudents,
                })}
              />
              {formik.touched.maxStudents && formik.errors.maxStudents && (
                <div className="text-danger small mt-1">
                  {formik.errors.maxStudents}
                </div>
              )}
            </div>

            <div className="fv-row mb-5">
              <label className="required fs-6 fw-bold mb-2">
                Maximum Contact Persons :
              </label>
              <input
                placeholder="Enter Maximum Contact Persons"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("maxContactPersons")}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger":
                    formik.touched.maxContactPersons &&
                    !!formik.errors.maxContactPersons,
                  "is-valid":
                    formik.touched.maxContactPersons &&
                    !formik.errors.maxContactPersons,
                })}
              />
              {formik.touched.maxContactPersons && formik.errors.maxContactPersons && (
                <div className="text-danger small mt-1">
                  {formik.errors.maxContactPersons}
                </div>
              )}
            </div>

            <div className="fv-row mb-2">
              <label className="fs-6 fw-bold mb-2">Institute Logo :</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoChange}
                className="form-control form-control-lg form-control-solid"
              />
              <div className="text-muted small mt-1">
                PNG or JPG/JPEG, under 1 MB. Used for white-label branding on student
                screens, emails and reports.
              </div>
              {logoError && (
                <div className="text-danger small mt-1">{logoError}</div>
              )}
              {(logoPreview || existing?.logoUrl) && (
                <div className="mt-3 text-center">
                  <img
                    src={logoPreview || existing?.logoUrl}
                    alt="Logo preview"
                    style={{
                      maxWidth: "120px",
                      maxHeight: "120px",
                      objectFit: "contain",
                      borderRadius: "8px",
                      border: "1px solid #e4e6ef",
                    }}
                  />
                </div>
              )}
            </div>

            <div className="fv-row mb-2 mt-6">
              <label className="fs-6 fw-bold mb-2">White-label this school :</label>
              <Form.Check
                type="switch"
                id="institute-whitelabel"
                label="Show this school's logo + name to its students (registration, assessment, thank-you) and in their emails, with a small “Powered by Career-9”."
                checked={!!formik.values.isWhitelabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  formik.setFieldValue("isWhitelabel", e.target.checked)
                }
              />
              {formik.values.isWhitelabel && !logoFile && !existing?.logoUrl && (
                <div className="text-warning small mt-1">
                  Upload a logo above for white-labeling to take effect.
                </div>
              )}
            </div>
          </form>
        )}

        {step === 2 && (
          <InstituteSessionDetailsPanel
            ref={sessionPanelRef}
            instituteCode={instituteCode}
          />
        )}

        {step === 3 && (
          <InstituteCatalogPicker
            instituteCode={Number(instituteCode)}
            active={true}
          />
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setStep((step - 1) as WizardStep)}
                disabled={loading}
              >
                Back
              </button>
            )}
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-light"
              onClick={onHide}
              disabled={loading}
            >
              Close
            </button>

            {step === 1 && (
              <button
                type="submit"
                form="institute-wizard-step1"
                className="btn btn-primary"
                disabled={loading || formik.isSubmitting || !formik.isValid}
              >
                {loading ? (
                  <>
                    Saving...{" "}
                    <span className="spinner-border spinner-border-sm align-middle ms-2" />
                  </>
                ) : (
                  "Save & Continue"
                )}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStep2SaveAndContinue}
                disabled={loading}
              >
                Continue
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="btn btn-success"
                onClick={handleFinish}
                disabled={loading}
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default InstituteWizardModal;
