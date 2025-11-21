import clsx from 'clsx';
import { Field, Form, Formik } from 'formik';
import { useEffect, useState, useRef } from 'react';
import * as Yup from 'yup';
import { Modal, Button } from 'react-bootstrap';
import { ReadCollegeData } from '../../College/API/College_APIs';
import CollegeCreateModal from '../../College/components/CollegeCreateModal';
import { ReadToolData } from '../../Tool/API/Tool_APIs';
import ToolCreateModal from '../../Tool/components/ToolCreateModal';
import { useNavigate } from 'react-router-dom';

/*
  AssessmentCreateModal
  ---------------------
  Replaces the previous multi-page step-1 + step-2 flow (AssessmentCreatePage + AssessmentToolPage)
  by merging Assessment basic info (name, college, pricing) and Tool selection into a single modal.

  On successful submit it stores the merged payload in localStorage under `assessmentStep2` (to keep
  compatibility with downstream step-3 logic that previously expected combined data after tool selection)
  and navigates to `/assessments/create/step-3`.

  If you later refactor step-3 to also be modal-based, update the navigation accordingly.
*/

interface AssessmentCreateModalProps {
    show: boolean;
    onHide: () => void;
    setPageLoading?: (v: any) => void;
}

const validationSchema = Yup.object().shape({
    name: Yup.string().required('Assessment name is required'),
    isFree: Yup.string().required('Assessment price type is required'),
    mode: Yup.string().oneOf(['online', 'offline']).required('Mode is required'),
    price: Yup.number()
        .typeError('Price must be a number')
        .when('isFree', {
            is: 'false',
            then: (schema) => schema.required('Please enter the price').positive('Must be positive'),
            otherwise: (schema) => schema.notRequired(),
        }),
    collegeId: Yup.string().required('College is required'),
    toolId: Yup.string().required('Tool is required'),
});

const AssessmentCreateModal = ({ show, onHide, setPageLoading }: AssessmentCreateModalProps) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const initialValues = {
        name: '',
        price: 0,
        isFree: 'true',
        mode: 'online',
        collegeId: '',
        toolId: '',
        schoolContactIds: [] as string[], // multiselect
        career9ContactIds: [] as string[], // multiselect
    };

    const [college, setCollege] = useState<any[]>([]);
    const [tools, setTools] = useState<any[]>([]);
    const [showCollegeModal, setShowCollegeModal] = useState(false);
    const [showToolModal, setShowToolModal] = useState(false);

    // Fetch Colleges when modal opens
    useEffect(() => {
        if (!show) return; // avoid unnecessary fetches when modal is closed
        const fetchCollege = async () => {
            try {
                const response = await ReadCollegeData();
                setCollege(response.data || []);
            } catch (error) {
                console.error('Error fetching college:', error);
            }
        };
        fetchCollege();
    }, [show]);

    // Fetch Tools when modal opens
    useEffect(() => {
        if (!show) return;
        const fetchTool = async () => {
            try {
                const response = await ReadToolData();
                setTools(response.data || []);
            } catch (error) {
                console.error('Error fetching tool:', error);
            }
        };
        fetchTool();
    }, [show]);

    // Re-fetch when a create sub-modal closes (so newly created items appear)
    const prevShowCollegeModalRef = useRef(showCollegeModal);
    useEffect(() => {
        // detect transition: true -> false
        if (prevShowCollegeModalRef.current && !showCollegeModal && show) {
            (async () => {
                try {
                    const response = await ReadCollegeData();
                    setCollege(response.data || []);
                } catch (error) {
                    console.error('Error re-fetching college after create:', error);
                }
            })();
        }
        prevShowCollegeModalRef.current = showCollegeModal;
    }, [showCollegeModal, show]);

    const prevShowToolModalRef = useRef(showToolModal);
    useEffect(() => {
        if (prevShowToolModalRef.current && !showToolModal && show) {
            (async () => {
                try {
                    const response = await ReadToolData();
                    setTools(response.data || []);
                } catch (error) {
                    console.error('Error re-fetching tool after create:', error);
                }
            })();
        }
        prevShowToolModalRef.current = showToolModal;
    }, [showToolModal, show]);

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Create Assessment</Modal.Title>
            </Modal.Header>
            <Formik
                enableReinitialize
                initialValues={initialValues}
                validationSchema={validationSchema}
                onSubmit={async (values) => {
                    setLoading(true);
                    try {
                        // const isFreeBool = values.isFree === 'true';
                        const payload = {
                            name: values.name,
                            //   isFree: isFreeBool,
                            //   price: isFreeBool ? 0 : Number(values.price),
                            collegeId: values.collegeId,
                            toolId: values.toolId,
                            schoolContactIds: values.schoolContactIds,
                            career9ContactIds: values.career9ContactIds,
                        };
                        // Maintain compatibility: store merged data under assessmentStep2 (previously after tool selection)
                        localStorage.setItem('assessmentStep2', JSON.stringify(payload));
                        onHide();
                        navigate('/assessments/create/step-3');
                    } catch (error) {
                        console.error(error);
                        window.location.replace('/error');
                    } finally {
                        setLoading(false);
                    }
                }}
            >
                {({ errors, touched, values, setFieldValue }) => (
                    <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
                        <Modal.Body>
                            {/* Assessment Name */}
                            <div className="fv-row mb-7">
                                <label className="required fs-6 fw-bold mb-2">Assessment Name:</label>
                                <Field
                                    as="input"
                                    name="name"
                                    placeholder="Enter Assessment Name"
                                    className={clsx('form-control form-control-lg form-control-solid', {
                                        'is-invalid text-danger': touched.name && errors.name,
                                        'is-valid': touched.name && !errors.name,
                                    })}
                                />
                                {touched.name && errors.name && (
                                    <div className="fv-plugins-message-container">
                                        <div className="fv-help-block text-danger">
                                            <span role="alert">{errors.name}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Select College */}
                            <div className="fv-row mb-7">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="required fs-6 fw-bold">Select College</label>
                                    <Button
                                        variant="light-primary"
                                        size="sm"
                                        type="button"
                                        onClick={() => setShowCollegeModal(true)}
                                    >
                                        Add New College
                                    </Button>
                                </div>
                                <CollegeCreateModal
                                    setPageLoading={setPageLoading ?? (() => { })}
                                    show={showCollegeModal}
                                    onHide={() => setShowCollegeModal(false)}
                                />
                                <Field
                                    as="select"
                                    name="collegeId"
                                    className={clsx('form-control form-control-lg form-control-solid', {
                                        'is-invalid text-danger': touched.collegeId && errors.collegeId,
                                        'is-valid': touched.collegeId && !errors.collegeId,
                                    })}
                                >
                                    <option value="">Select College</option>
                                    {college.map((inst) => (
                                        <option key={inst.instituteCode} value={inst.instituteCode}>
                                            {inst.instituteName}
                                        </option>
                                    ))}
                                </Field>
                                {touched.collegeId && errors.collegeId && (
                                    <div className="fv-plugins-message-container">
                                        <div className="fv-help-block text-danger">
                                            <span role="alert">{errors.collegeId}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tool Selection */}
                            <div className="fv-row mb-7">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <label className="required fs-6 fw-bold">Select Tool</label>
                                    <Button
                                        variant="light-primary"
                                        size="sm"
                                        type="button"
                                        onClick={() => setShowToolModal(true)}
                                    >
                                        Add New Tool
                                    </Button>
                                </div>
                                <ToolCreateModal
                                    setPageLoading={setPageLoading ?? (() => { })}
                                    show={showToolModal}
                                    onHide={() => setShowToolModal(false)}
                                />
                                <Field
                                    as="select"
                                    name="toolId"
                                    className={clsx('form-control form-control-lg form-control-solid', {
                                        'is-invalid text-danger': touched.toolId && errors.toolId,
                                        'is-valid': touched.toolId && !errors.toolId,
                                    })}
                                >
                                    <option value="">Select Tool</option>
                                    {tools.map((tool) => (
                                        <option key={tool.id} value={tool.id}>
                                            {tool.name}
                                        </option>
                                    ))}
                                </Field>
                                {touched.toolId && errors.toolId && (
                                    <div className="fv-plugins-message-container">
                                        <div className="fv-help-block text-danger">
                                            <span role="alert">{errors.toolId}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="fv-row mb-7">
                                <label className="fs-6 fw-bold mb-2">Mode Of Assessment</label>
                                <div className="d-flex gap-4">
                                    <div className="form-check">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="mode"
                                            id="mode-online"
                                            value="online"
                                            checked={values.mode === 'online'}
                                            onChange={() => setFieldValue('mode', 'online')}
                                        />
                                        <label className="form-check-label" htmlFor="mode-online">
                                            Online
                                        </label>
                                    </div>
                                    <div className="form-check">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="mode"
                                            id="mode-offline"
                                            value="offline"
                                            checked={values.mode === 'offline'}
                                            onChange={() => setFieldValue('mode', 'offline')}
                                        />
                                        <label className="form-check-label" htmlFor="mode-offline">
                                            Offline
                                        </label>
                                    </div>
                                </div>



                            </div>
                            {/* School Contacts Checkbox Dropdown */}
                            <div className="fv-row mb-7">
                                <label className="fs-6 fw-bold mb-2">Select School Contacts (optional)</label>
                                <div className="border rounded p-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {/* Sample static options - replace with dynamic data later */}
                                    {[
                                        { id: 'sc1', name: 'School Contact A' },
                                        { id: 'sc2', name: 'School Contact B' },
                                        { id: 'sc3', name: 'School Contact C' },
                                    ].map((contact) => (
                                        <div key={contact.id} className="form-check mb-2">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id={`school-${contact.id}`}
                                                checked={values.schoolContactIds.includes(contact.id)}
                                                onChange={(e) => {
                                                    const currentIds = values.schoolContactIds;
                                                    if (e.target.checked) {
                                                        setFieldValue('schoolContactIds', [...currentIds, contact.id]);
                                                    } else {
                                                        setFieldValue('schoolContactIds', currentIds.filter(id => id !== contact.id));
                                                    }
                                                }}
                                            />
                                            <label className="form-check-label" htmlFor={`school-${contact.id}`}>
                                                {contact.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Career-9 Contacts Checkbox Dropdown */}
                            <div className="fv-row mb-7">
                                <label className="fs-6 fw-bold mb-2">Select Career-9 Contacts (optional)</label>
                                <div className="border rounded p-3" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {/* Sample static options - replace with dynamic data later */}
                                    {[
                                        { id: 'c9a', name: 'Career-9 Contact A' },
                                        { id: 'c9b', name: 'Career-9 Contact B' },
                                        { id: 'c9c', name: 'Career-9 Contact C' },
                                    ].map((contact) => (
                                        <div key={contact.id} className="form-check mb-2">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id={`career9-${contact.id}`}
                                                checked={values.career9ContactIds.includes(contact.id)}
                                                onChange={(e) => {
                                                    const currentIds = values.career9ContactIds;
                                                    if (e.target.checked) {
                                                        setFieldValue('career9ContactIds', [...currentIds, contact.id]);
                                                    } else {
                                                        setFieldValue('career9ContactIds', currentIds.filter(id => id !== contact.id));
                                                    }
                                                }}
                                            />
                                            <label className="form-check-label" htmlFor={`career9-${contact.id}`}>
                                                {contact.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pricing Toggle */}

                        </Modal.Body>
                        <Modal.Footer className="d-flex justify-content-end">
                            <Button variant="light" type="button" onClick={onHide} disabled={loading}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit" disabled={loading}>
                                {!loading && <span className="indicator-label">Continue</span>}
                                {loading && (
                                    <span className="indicator-progress" style={{ display: 'block' }}>
                                        Please wait...{' '}
                                        <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                                    </span>
                                )}
                            </Button>
                        </Modal.Footer>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
};

export default AssessmentCreateModal;