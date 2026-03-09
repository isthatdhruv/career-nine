// Career-9 Assessment - Global Application State
const AppState = {
  // Assessment data from API
  assessmentData: null,
  assessmentConfig: null,
  assessmentLoading: false,
  assessmentError: null,

  // Helpers to load from sessionStorage on startup
  init() {
    try {
      const d = sessionStorage.getItem('assessmentData');
      if (d) this.assessmentData = JSON.parse(d);
    } catch (e) { /* ignore */ }
    try {
      const c = sessionStorage.getItem('assessmentConfig');
      if (c) this.assessmentConfig = JSON.parse(c);
    } catch (e) { /* ignore */ }
  },

  setAssessmentData(data) {
    this.assessmentData = data;
    try { sessionStorage.setItem('assessmentData', JSON.stringify(data)); } catch (e) { /* ignore */ }
  },

  setAssessmentConfig(config) {
    this.assessmentConfig = config;
    try { sessionStorage.setItem('assessmentConfig', JSON.stringify(config)); } catch (e) { /* ignore */ }
  },

  clearAssessment() {
    this.assessmentData = null;
    this.assessmentConfig = null;
    sessionStorage.removeItem('assessmentData');
    sessionStorage.removeItem('assessmentConfig');
  }
};

// Initialize state on load
AppState.init();
