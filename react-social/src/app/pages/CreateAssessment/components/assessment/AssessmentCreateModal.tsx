import clsx from 'clsx';
import { Field, Form, Formik } from 'formik';
import { useEffect, useState, useRef } from 'react';
import * as Yup from 'yup';
import { Modal, Button } from 'react-bootstrap';
import { ReadCollegeData } from '../../../College/API/College_APIs';
import CollegeCreateModal from '../../../College/components/CollegeCreateModal';
import { useNavigate } from 'react-router-dom';

interface AssessmentCreateModalProps {
    show: boolean;
    onHide: () => void;
    setPageLoading?: (v: any) => void;
}

const validationSchema = Yup.object().shape({
    name: Yup.string().required('Assessment name is required'),
    mode: Yup.string().oneOf(['online', 'offline']).required('Mode is required'),
    collegeId: Yup.string().required('College is required'),
});

const AssessmentCreateModal = ({ show, onHide, setPageLoading }: AssessmentCreateModalProps) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [collegeLoading, setCollegeLoading] = useState(false);

    const initialValues = {
        name: '',
        mode: 'online',
        collegeId: '',
        schoolContactIds: [] as string[],
        career9ContactIds: [] as string[],
    };

    const [college, setCollege] = useState<any[]>([]);
    const [showCollegeModal, setShowCollegeModal] = useState(false);

    // Fetch Colleges when modal opens
    useEffect(() => {
        if (!show) return;
        
        const fetchCollege = async () => {
            setCollegeLoading(true);
            try {
                console.log('Fetching colleges...'); // Debug log
                const response = await ReadCollegeData();
                console.log('College response:', response); // Debug log
                
                // Handle different response structures
                if (response?.data) {
                    setCollege(response.data);
                } else if (Array.isArray(response)) {
                    setCollege(response);
                } else {
                    console.warn('Unexpected college response format:', response);
                    setCollege([]);
                }
            } catch (error) {
                console.error('Error fetching colleges:', error);
                setCollege([]);
            } finally {
                setCollegeLoading(false);
            }
        };
        
        fetchCollege();
    }, [show]);

    // Re-fetch when college create modal closes
    const prevShowCollegeModalRef = useRef(showCollegeModal);
    useEffect(() => {
        if (prevShowCollegeModalRef.current && !showCollegeModal && show) {
            (async () => {
                try {
                    console.log('Re-fetching colleges after create...'); // Debug log
                    const response = await ReadCollegeData();
                    if (response?.data) {
                        setCollege(response.data);
                    } else if (Array.isArray(response)) {
                        setCollege(response);
                    } else {
                        setCollege([]);
                    }
                } catch (error) {
                    console.error('Error re-fetching colleges after create:', error);
                }
            })();
        }
        prevShowCollegeModalRef.current = showCollegeModal;
    }, [showCollegeModal, show]);

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
                        const payload = {
                            name: values.name,
                            mode: values.mode,
                            collegeId: values.collegeId,
                            schoolContactIds: values.schoolContactIds,
                            career9ContactIds: values.career9ContactIds,
                        };
                        
                        console.log('Submitting assessment payload:', payload); // Debug log
                        
                        // Store data for next step
                        localStorage.setItem('assessmentStep2', JSON.stringify(payload));
                        onHide();
                        navigate('/assessments/create/step-3');
                    } catch (error) {
                        console.error('Error submitting assessment:', error);
                        // Instead of redirecting to error page, you might want to show a toast/alert
                        alert('Error creating assessment. Please try again.');
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
                                    disabled={collegeLoading}
                                    className={clsx('form-control form-control-lg form-control-solid', {
                                        'is-invalid text-danger': touched.collegeId && errors.collegeId,
                                        'is-valid': touched.collegeId && !errors.collegeId,
                                    })}
                                >
                                    <option value="">
                                        {collegeLoading ? 'Loading colleges...' : 'Select College'}
                                    </option>
                                    {college.map((inst) => (
                                        <option key={inst.instituteCode || inst.id} value={inst.instituteCode || inst.id}>
                                            {inst.instituteName || inst.name}
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
                                {college.length === 0 && !collegeLoading && (
                                    <small className="text-muted">No colleges found. Add a new college to continue.</small>
                                )}
                            </div>

                            {/* Mode Of Assessment */}
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