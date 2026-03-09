// Career-9 Assessment - Select Section Page
Pages.selectSection = {
  async render() {
    preventReload();

    const assessmentId = localStorage.getItem('assessmentId');
    const userStudentId = localStorage.getItem('userStudentId');

    // Check student status first
    if (assessmentId && userStudentId) {
      try {
        const res = await API.getAssessmentStudentStatus(assessmentId, userStudentId);
        const { isActive, studentStatus } = res.data;
        if (!isActive) {
          alert('This assessment is not active.');
          Router.navigate('student-login');
          return;
        }
        if (studentStatus === 'completed') {
          alert('You have already completed this assessment.');
          Router.navigate('student-login');
          return;
        }
      } catch (err) {
        console.error('Error checking student status:', err);
      }
    }

    const questionnaire = AppState.assessmentData && AppState.assessmentData[0];
    let sections = [];
    if (questionnaire) {
      try {
        sections = questionnaire.sections.map(item => ({
          sectionId: item.section.sectionId,
          sectionName: item.section.sectionName,
          sectionDescription: item.section.sectionDescription || ''
        }));
      } catch (e) {
        console.error('Failed to process sections:', e);
      }
    }

    let sectionsHtml = '';
    if (!questionnaire) {
      sectionsHtml = `
        <div class="text-center my-5" style="padding:3rem 2rem;">
          <div class="spinner-border" style="width:3rem;height:3rem;color:#667eea;margin-bottom:1rem;"></div>
          <p style="color:#718096;font-size:1rem;margin-top:1rem;">Loading sections...</p>
        </div>`;
    } else if (sections.length === 0) {
      sectionsHtml = `
        <div class="text-center my-5" style="padding:3rem 2rem;">
          <h4 style="color:#4a5568;font-size:1.25rem;font-weight:600;margin-bottom:.5rem;">No Sections Available</h4>
          <p style="color:#9ca3af;font-size:.95rem;">There are no sections to display at this time.</p>
        </div>`;
    } else {
      sections.forEach((s, idx) => {
        sectionsHtml += `
          <div class="section-card" data-section="${s.sectionId}">
            <div class="card-body" style="padding:1.5rem;display:flex;justify-content:space-between;
              align-items:center;gap:1.5rem;">
              <div style="width:48px;height:48px;min-width:48px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                border-radius:12px;display:flex;align-items:center;justify-content:center;
                color:white;font-size:1.25rem;font-weight:700;box-shadow:0 4px 12px rgba(102,126,234,.3);">
                ${idx + 1}
              </div>
              <div style="flex:1;">
                <h6 style="margin-bottom:${s.sectionDescription ? '.5rem' : '0'};font-size:1.15rem;
                  font-weight:600;color:#2d3748;">${escapeHtml(s.sectionName)}</h6>
                ${s.sectionDescription ? `<p style="margin:0;font-size:.9rem;color:#718096;line-height:1.5;">${escapeHtml(s.sectionDescription)}</p>` : ''}
              </div>
              <div style="width:40px;height:40px;min-width:40px;background:#f7fafc;border-radius:10px;
                display:flex;align-items:center;justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </div>
            </div>
          </div>`;
      });
    }

    const footerHtml = sections.length > 0 ? `
      <div class="text-center mt-4" style="padding:1rem;background:#f7fafc;border-radius:12px;margin-top:2rem;">
        <p style="margin:0;color:#718096;font-size:.9rem;">💡 Click on any section to begin</p>
      </div>` : '';

    $('#app-root').html(`
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
        background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:2rem 1rem;
        overflow-y:auto;color-scheme:light;">
        <div class="card shadow-lg" style="width:700px;max-width:95%;border-radius:24px;border:none;background:#fff;">
          <div class="card-body p-5" style="background:#fff;color:#2d3748;border-radius:24px;">

            <div style="width:80px;height:80px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              border-radius:50%;display:flex;align-items:center;justify-content:center;
              margin:0 auto 1.5rem;box-shadow:0 4px 15px rgba(102,126,234,.4);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>

            <h2 class="text-center mb-2" style="font-size:2.25rem;font-weight:700;color:#2d3748;">Select Section</h2>
            <p class="text-center mb-5" style="color:#718096;font-size:1.05rem;">Choose a section to begin your assessment</p>

            <div id="sections-list">${sectionsHtml}</div>
            ${footerHtml}
          </div>
        </div>
      </div>
    `);

    $(document).on('click', '.section-card', function() {
      const sectionId = $(this).data('section');
      Router.navigate(`studentAssessment/sections/${sectionId}`);
    });
  }
};
