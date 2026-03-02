// Career-9 Assessment - Section Instruction Page
Pages.sectionInstruction = {
  render(sectionId) {
    preventReload();

    const questionnaire = AppState.assessmentData && AppState.assessmentData[0];
    if (!questionnaire) {
      // No data — skip to questions
      Router.navigate(`studentAssessment/sections/${sectionId}/questions/0`);
      return;
    }

    const section = questionnaire.sections.find(
      s => String(s.section.sectionId) === String(sectionId)
    );

    if (!section || !section.instruction || section.instruction.length === 0) {
      Router.navigate(`studentAssessment/sections/${sectionId}/questions/0`);
      return;
    }

    const nonNA = section.instruction.filter(
      inst => inst.instructionText && !isNA(inst.instructionText)
    );

    if (nonNA.length === 0) {
      Router.navigate(`studentAssessment/sections/${sectionId}/questions/0`);
      return;
    }

    const isMulti = nonNA.length > 1;
    let instructionsHtml = `<div style="display:grid;grid-template-columns:${isMulti ? '1fr 1px 1fr' : '1fr'};gap:2rem;margin-bottom:2.5rem;">`;
    nonNA.forEach((inst, idx) => {
      instructionsHtml += `
        <div>
          <div class="lang-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            ${escapeHtml(inst.language?.languageName || 'English')}
          </div>
          <div style="background:#f7fafc;border:2px solid #e2e8f0;border-radius:16px;padding:2rem;
            min-height:200px;white-space:pre-line;font-size:1.05rem;line-height:1.8;color:#2d3748;
            box-shadow:0 2px 8px rgba(0,0,0,.04);">${escapeHtml(inst.instructionText)}</div>
        </div>`;
      if (idx === 0 && isMulti) {
        instructionsHtml += `<div style="width:1px;background:#e2e8f0;align-self:stretch;"></div>`;
      }
    });
    instructionsHtml += '</div>';

    $('#app-root').html(`
      <div style="min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        display:flex;align-items:center;justify-content:center;padding:2rem 1rem;color-scheme:light;">
        <div class="card shadow-lg" style="width:1000px;max-width:98%;border-radius:24px;border:none;background:#fff;">
          <div class="card-body p-5" style="background:#fff;color:#2d3748;border-radius:24px;">

            <div style="width:80px;height:80px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              border-radius:50%;display:flex;align-items:center;justify-content:center;
              margin:0 auto 1.5rem;box-shadow:0 4px 15px rgba(102,126,234,.4);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>

            <h2 class="text-center mb-2" style="font-size:2.25rem;font-weight:700;color:#2d3748;">Section Instructions</h2>
            <p class="text-center mb-5" style="color:#718096;font-size:1.05rem;">
              Please read the instructions carefully before proceeding
            </p>

            ${instructionsHtml}

            <div class="info-box" style="margin-bottom:2.5rem;">
              <div style="width:40px;height:40px;min-width:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                border-radius:50%;display:flex;align-items:center;justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div>
                <p style="margin:0;color:#4a5568;font-size:.95rem;font-weight:500;">
                  <strong style="color:#2d3748;">Ready to begin?</strong> Make sure you've read and understood all the instructions before starting.
                </p>
              </div>
            </div>

            <div class="text-center">
              <button id="start-section-btn" class="btn"
                style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;
                padding:1rem 3.5rem;border-radius:14px;font-size:1.15rem;font-weight:600;border:none;
                box-shadow:0 4px 15px rgba(102,126,234,.4);transition:all .3s ease;
                display:inline-flex;align-items:center;gap:.75rem;">
                <span>Start Assessment</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
            <p class="text-center mt-4" style="color:#9ca3af;font-size:.9rem;margin:1.5rem 0 0 0;">
              Click the button above when you're ready to begin
            </p>
          </div>
        </div>
      </div>
    `);

    $('#start-section-btn')
      .on('mouseenter', function() { $(this).css({ transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(102,126,234,.5)' }); })
      .on('mouseleave', function() { $(this).css({ transform: 'translateY(0)', boxShadow: '0 4px 15px rgba(102,126,234,.4)' }); })
      .on('click', function() {
        Router.navigate(`studentAssessment/sections/${sectionId}/questions/0`);
      });
  }
};
