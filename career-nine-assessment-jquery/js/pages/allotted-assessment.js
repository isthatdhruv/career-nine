// Career-9 Assessment - Allotted Assessment Page
Pages.allottedAssessment = {
  render() {
    preventReload();
    const assessments = JSON.parse(localStorage.getItem('allottedAssessments') || '[]');

    function getStatusColor(status, isActive) {
      if (status === 'completed') return { bg: '#d1fae5', text: '#059669', border: '#10b981' };
      if (!isActive) return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
      if (status === 'ongoing') return { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' };
      return { bg: '#fff7ed', text: '#ea580c', border: '#f97316' };
    }

    function getStatusLabel(status, isActive) {
      if (status === 'completed') return 'Completed';
      if (!isActive) return 'Inactive';
      if (status === 'ongoing') return 'Ongoing';
      return 'Not Started';
    }

    function getStatusIcon(status, isActive) {
      if (status === 'completed') return '✓';
      if (!isActive) return '⏸';
      if (status === 'ongoing') return '⟳';
      return '○';
    }

    function getTopBorder(status, isActive) {
      if (status === 'completed') return 'linear-gradient(90deg,#10b981 0%,#059669 100%)';
      if (!isActive) return 'linear-gradient(90deg,#9ca3af 0%,#6b7280 100%)';
      return 'linear-gradient(90deg,#667eea 0%,#764ba2 100%)';
    }

    const active = assessments.filter(a => a.isActive);

    let cardsHtml = '';
    if (active.length === 0) {
      cardsHtml = `
        <div style="background:white;padding:4rem 2.5rem;border-radius:24px;text-align:center;
          box-shadow:0 20px 60px rgba(0,0,0,.15);max-width:550px;margin:0 auto;">
          <div style="width:120px;height:120px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            margin:0 auto 2rem;font-size:3.5rem;">📭</div>
          <h3 style="color:#2d3748;font-size:1.75rem;font-weight:700;margin-bottom:.75rem;">No Assessments Found</h3>
          <p style="color:#718096;font-size:1.05rem;line-height:1.6;">
            There are currently no assessments allotted to your account. Please check back later or contact your administrator.
          </p>
        </div>`;
    } else {
      cardsHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:2rem;">`;
      active.forEach(a => {
        const sc = getStatusColor(a.studentStatus, a.isActive);
        const label = getStatusLabel(a.studentStatus, a.isActive);
        const icon = getStatusIcon(a.studentStatus, a.isActive);
        const border = getTopBorder(a.studentStatus, a.isActive);
        const disabled = a.studentStatus === 'completed' || !a.isActive;

        let btnBg = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
        let btnColor = 'white';
        let btnLabel = a.studentStatus === 'ongoing' ? 'Continue Assessment →' : 'Start Assessment →';
        if (a.studentStatus === 'completed') { btnBg = 'linear-gradient(135deg,#10b981 0%,#059669 100%)'; btnLabel = '✓ Completed'; }
        if (!a.isActive) { btnBg = '#e5e7eb'; btnColor = '#9ca3af'; btnLabel = 'Unavailable'; }

        cardsHtml += `
          <div class="assessment-card" data-id="${a.assessmentId}" data-disabled="${disabled}">
            <div style="height:6px;background:${border};"></div>
            <div style="padding:2rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <span style="background-color:${sc.bg};color:${sc.text};padding:.5rem 1rem;border-radius:50px;
                  font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
                  border:2px solid ${sc.border}40;display:flex;align-items:center;gap:.5rem;">
                  <span style="font-size:1rem;">${icon}</span>${label}
                </span>
                <span style="background:#f3f4f6;color:#6b7280;padding:.4rem .85rem;border-radius:50px;
                  font-size:.8rem;font-weight:600;">#${a.assessmentId}</span>
              </div>
              <div style="width:70px;height:70px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                border-radius:16px;display:flex;align-items:center;justify-content:center;
                margin-bottom:1.5rem;box-shadow:0 4px 15px rgba(102,126,234,.3);">
                <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <h3 style="font-size:1.6rem;font-weight:700;color:#1f2937;margin-bottom:.75rem;line-height:1.3;">
                ${escapeHtml(a.assessmentName || 'Assessment Module')}
              </h3>
              <p style="color:#6b7280;font-size:.95rem;margin-bottom:2rem;line-height:1.6;">
                Complete this assessment to evaluate your skills and knowledge.
              </p>
              <button class="start-btn" data-id="${a.assessmentId}"
                style="width:100%;padding:1rem;border-radius:14px;border:none;font-size:1.05rem;
                font-weight:600;background:${btnBg};color:${btnColor};cursor:${disabled ? 'not-allowed' : 'pointer'};
                transition:all .3s ease;display:flex;align-items:center;justify-content:center;gap:.75rem;
                box-shadow:${disabled ? 'none' : '0 4px 15px rgba(102,126,234,.4)'};
                opacity:${disabled ? 0.7 : 1};" ${disabled ? 'disabled' : ''}>
                <span class="btn-label">${btnLabel}</span>
              </button>
            </div>
          </div>`;
      });
      cardsHtml += '</div>';
    }

    $('#app-root').html(`
      <div style="min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        padding:3rem 1.5rem;font-family:'Inter',-apple-system,sans-serif;">
        <div style="max-width:1200px;width:100%;margin:0 auto;">
          <header style="margin-bottom:3rem;text-align:center;">
            <div style="width:100px;height:100px;background:rgba(255,255,255,.25);backdrop-filter:blur(10px);
              border-radius:50%;display:flex;align-items:center;justify-content:center;
              margin:0 auto 1.5rem;box-shadow:0 8px 32px rgba(0,0,0,.1);border:2px solid rgba(255,255,255,.3);">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <h1 style="font-size:3rem;font-weight:800;color:white;margin-bottom:.75rem;letter-spacing:-.025em;">My Assessments</h1>
            <p style="color:rgba(255,255,255,.9);font-size:1.15rem;">Select an assessment below to begin or continue your progress</p>
          </header>
          ${cardsHtml}
        </div>
      </div>

      <!-- Ongoing modal -->
      <div id="ongoing-modal" class="modal-overlay" style="display:none;">
        <div style="background:white;border-radius:24px;padding:2.5rem;max-width:420px;width:90%;text-align:center;
          box-shadow:0 25px 50px rgba(0,0,0,.25);" onclick="event.stopPropagation()">
          <div style="width:80px;height:80px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            margin:0 auto 1.5rem;box-shadow:0 8px 24px rgba(245,158,11,.4);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 style="font-size:1.5rem;font-weight:700;color:#1f2937;margin-bottom:.75rem;">Assessment In Progress</h3>
          <p style="color:#6b7280;font-size:1rem;line-height:1.6;margin-bottom:2rem;">
            Your assessment is currently in progress. Please contact your <strong>administrator</strong> to reset if needed.
          </p>
          <button id="close-ongoing" class="btn-gradient" style="padding:.875rem 2.5rem;border-radius:12px;">Got it</button>
        </div>
      </div>

      <!-- Mobile warning modal -->
      <div id="mobile-modal" class="modal-overlay" style="display:none;">
        <div style="background:white;border-radius:24px;padding:2.5rem;max-width:480px;width:90%;text-align:center;
          box-shadow:0 25px 50px rgba(0,0,0,.3);" onclick="event.stopPropagation()">
          <div style="width:90px;height:90px;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            margin:0 auto 1.5rem;box-shadow:0 8px 24px rgba(239,68,68,.5);">
            <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </div>
          <h3 style="font-size:1.65rem;font-weight:800;color:#1f2937;margin-bottom:1rem;">Desktop Required</h3>
          <p style="color:#4b5563;font-size:1.05rem;line-height:1.7;margin-bottom:1.25rem;">
            This assessment <strong>cannot be completed</strong> on a mobile device, tablet, or iPad.
          </p>
          <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:16px;
            padding:1.25rem;margin-bottom:2rem;border:2px solid #fbbf24;">
            <p style="color:#92400e;font-size:.95rem;font-weight:600;line-height:1.6;margin:0;">
              🖥️ Please open this assessment on a <strong>Desktop or Laptop computer</strong> to continue.
            </p>
          </div>
          <button id="close-mobile" class="btn-gradient w-100" style="padding:1rem;border-radius:14px;font-size:1.05rem;font-weight:700;">
            I Understand
          </button>
        </div>
      </div>
    `);

    // ── Event handlers ──────────────────────────────────────────────────────
    $('#close-ongoing').on('click', () => $('#ongoing-modal').hide());
    $('#ongoing-modal').on('click', () => $('#ongoing-modal').hide());
    $('#close-mobile').on('click', () => $('#mobile-modal').hide());
    $('#mobile-modal').on('click', () => $('#mobile-modal').hide());

    $(document).on('click', '.start-btn', async function() {
      const assessmentId = $(this).data('id');
      const assessment = active.find(a => a.assessmentId === assessmentId);
      if (!assessment) return;
      if (assessment.studentStatus === 'completed' || !assessment.isActive) return;

      if (isMobileOrTablet()) {
        $('#mobile-modal').show();
        return;
      }

      const userStudentId = localStorage.getItem('userStudentId');
      if (!userStudentId) {
        alert('Session expired. Please login again.');
        Router.navigate('student-login');
        return;
      }

      const $btn = $(this);
      $btn.prop('disabled', true).find('.btn-label').html('<span class="spinner-border spinner-border-sm"></span> Loading...');

      try {
        localStorage.setItem('assessmentId', String(assessmentId));

        const statusRes = await API.getDemographicStatus(assessmentId, userStudentId);
        const demoStatus = statusRes.data;

        if (demoStatus.totalFields > 0 && !demoStatus.completed) {
          Router.navigate(`demographics/${assessmentId}`);
          return;
        }

        await API.startAssessment(userStudentId, assessmentId);
        await fetchAndCacheAssessmentData(assessmentId);
        Router.navigate('general-instructions');
      } catch (error) {
        console.error('Error starting assessment:', error);
        alert('Failed to start assessment. Please try again.');
        $btn.prop('disabled', false).find('.btn-label').text(
          assessment.studentStatus === 'ongoing' ? 'Continue Assessment →' : 'Start Assessment →'
        );
      }
    });
  }
};
