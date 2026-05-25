import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getCareerComparison } from './API/CareerSuggestion_APIs';
import ComparisonView from './components/ComparisonView';

const API_URL = process.env.REACT_APP_API_URL;

interface Assessment {
  id: number;
  AssessmentName: string;
}

interface StudentOption {
  userStudentId: number;
  name: string;
}

const CareerSuggestionPage: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/assessments/getAll`)
      .then((res) => setAssessments(res.data))
      .catch(() => setError('Failed to load assessments.'));
  }, []);

  const handleAssessmentChange = (assessmentId: string) => {
    setSelectedStudent(null);
    setStudents([]);
    setComparisonData(null);
    setError('');

    if (!assessmentId) {
      setSelectedAssessment(null);
      return;
    }

    const found = assessments.find((a) => String(a.id) === assessmentId) || null;
    setSelectedAssessment(found);

    setLoadingStudents(true);
    axios.get(`${API_URL}/career-suggestion/assessment/${assessmentId}/students`)
      .then((res) => setStudents(res.data))
      .catch(() => setError('Failed to load students for this assessment.'))
      .finally(() => setLoadingStudents(false));
  };

  const handleCompare = async () => {
    if (!selectedAssessment || !selectedStudent) {
      setError('Please select both an assessment and a student.');
      return;
    }
    setError('');
    setComparisonData(null);
    setLoadingCompare(true);
    try {
      const res = await getCareerComparison(selectedStudent.userStudentId, selectedAssessment.id);
      setComparisonData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Comparison failed. Make sure Ollama is running with qwen3.');
    } finally {
      setLoadingCompare(false);
    }
  };

  return (
    <div className='container-fluid py-6'>
      <h2 className='fw-bold mb-6'>Career Suggestion — Program vs Qwen3</h2>

      <div className='card shadow-sm mb-6'>
        <div className='card-body'>
          <div className='row g-4 align-items-end'>

            {/* Assessment selector */}
            <div className='col-md-4'>
              <label className='form-label fw-semibold'>Assessment</label>
              <select
                className='form-select'
                value={selectedAssessment?.id ?? ''}
                onChange={(e) => handleAssessmentChange(e.target.value)}
              >
                <option value=''>-- Select Assessment --</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.AssessmentName} &nbsp;(ID: {a.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Student selector — enabled only after assessment chosen */}
            <div className='col-md-4'>
              <label className='form-label fw-semibold'>Student</label>
              <select
                className='form-select'
                value={selectedStudent?.userStudentId ?? ''}
                onChange={(e) => {
                  const s = students.find((s) => String(s.userStudentId) === e.target.value) || null;
                  setSelectedStudent(s);
                  setComparisonData(null);
                }}
                disabled={!selectedAssessment || loadingStudents}
              >
                <option value=''>
                  {loadingStudents ? 'Loading students...' : '-- Select Student --'}
                </option>
                {students.map((s) => (
                  <option key={s.userStudentId} value={s.userStudentId}>
                    {s.name} &nbsp;(ID: {s.userStudentId})
                  </option>
                ))}
              </select>
              {selectedAssessment && !loadingStudents && students.length === 0 && (
                <div className='form-text text-warning'>No students found for this assessment.</div>
              )}
            </div>

            {/* Compare button */}
            <div className='col-md-4'>
              <button
                className='btn btn-primary w-100'
                onClick={handleCompare}
                disabled={loadingCompare || !selectedAssessment || !selectedStudent}
              >
                {loadingCompare ? (
                  <><span className='spinner-border spinner-border-sm me-2' />Comparing...</>
                ) : 'Compare'}
              </button>
            </div>
          </div>

          {/* Selection summary */}
          {selectedAssessment && selectedStudent && (
            <div className='mt-4 p-3 bg-light rounded d-flex gap-6 flex-wrap'>
              <span>
                <span className='text-muted me-1'>Assessment:</span>
                <strong>{selectedAssessment.AssessmentName}</strong>
                <span className='badge badge-light-primary ms-2'>ID: {selectedAssessment.id}</span>
              </span>
              <span>
                <span className='text-muted me-1'>Student:</span>
                <strong>{selectedStudent.name}</strong>
                <span className='badge badge-light-info ms-2'>ID: {selectedStudent.userStudentId}</span>
              </span>
            </div>
          )}

          {error && <div className='alert alert-danger mt-4 mb-0'>{error}</div>}
        </div>
      </div>

      {comparisonData && <ComparisonView data={comparisonData} />}
    </div>
  );
};

export default CareerSuggestionPage;
