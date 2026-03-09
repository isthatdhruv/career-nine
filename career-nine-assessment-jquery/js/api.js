// Career-9 Assessment - API Functions

// Create axios instance with base config
const http = axios.create({
  baseURL: AppConfig.API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 15000
});

// Auth
const API = {
  login(dobDate, username) {
    return http.post('/user/auth', { dobDate, username });
  },

  // Assessment
  getAssessmentQuestionnaire(assessmentId) {
    return http.get(`/assessments/getby/${assessmentId}`);
  },
  getAssessmentConfig(assessmentId) {
    return http.get(`/assessments/getById/${assessmentId}`);
  },
  startAssessment(userStudentId, assessmentId) {
    return http.post('/assessments/startAssessment', {
      userStudentId: Number(userStudentId),
      assessmentId: Number(assessmentId)
    });
  },
  getAssessmentStudentStatus(assessmentId, userStudentId) {
    return http.get(`/assessments/${assessmentId}/student/${userStudentId}`);
  },

  // Demographics
  getDemographicStatus(assessmentId, userStudentId) {
    return http.get(`/student-demographics/status/${assessmentId}/${userStudentId}`);
  },
  getDemographicFields(assessmentId, userStudentId) {
    return http.get(`/student-demographics/fields/${assessmentId}/${userStudentId}`);
  },
  submitDemographics(userStudentId, assessmentId, responses) {
    return http.post('/student-demographics/submit', {
      userStudentId: Number(userStudentId),
      assessmentId: Number(assessmentId),
      responses
    });
  },

  // Submit assessment answers
  submitAnswers(submissionData) {
    return http.post('/assessment-answer/submit', submissionData);
  },

  // Register by token
  getRegistrationInfo(token) {
    return http.get(`/assessment-register/info/${token}`);
  },
  registerStudent(token, data) {
    return http.post(`/assessment-register/register/${token}`, data);
  }
};

// Fetch assessment data and cache to state
async function fetchAndCacheAssessmentData(assessmentId) {
  AppState.assessmentLoading = true;
  AppState.assessmentError = null;
  try {
    const [questionnaireRes, configRes] = await Promise.all([
      API.getAssessmentQuestionnaire(assessmentId),
      API.getAssessmentConfig(assessmentId)
    ]);
    AppState.setAssessmentData(questionnaireRes.data);
    AppState.setAssessmentConfig(configRes.data);
  } catch (err) {
    AppState.assessmentError = err.message || 'Unknown error';
    console.error('Error fetching assessment data:', err);
    throw err;
  } finally {
    AppState.assessmentLoading = false;
  }
}
