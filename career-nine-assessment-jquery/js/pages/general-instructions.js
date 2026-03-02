// Career-9 Assessment - General Instructions Page
Pages.generalInstructions = {
  render() {
    preventReload();

    if (AppState.assessmentLoading) {
      $('#app-root').html(`
        <div class="page-center" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
          <div class="text-center">
            <div class="spinner-border text-light" style="width:3rem;height:3rem;"></div>
            <p class="mt-3 text-white fw-semibold">Loading instructions...</p>
          </div>
        </div>`);
      return;
    }

    const questionnaire = AppState.assessmentData && AppState.assessmentData[0];
    const langInstructions = (questionnaire?.languages || []).filter(
      l => l.instructions && l.instructions.trim() && !isNA(l.instructions)
    );

    // Auto-skip if no instructions
    if (questionnaire && langInstructions.length === 0) {
      Router.navigate('studentAssessment');
      return;
    }

    const isMulti = langInstructions.length > 1;
    let instructionsHtml = '';

    if (langInstructions.length > 0) {
      instructionsHtml = `<div style="display:grid;grid-template-columns:${isMulti ? '1fr 1px 1fr' : '1fr'};gap:2rem;margin-bottom:3rem;">`;
      langInstructions.forEach((lang, idx) => {
        instructionsHtml += `
          <div>
            <div class="lang-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              ${escapeHtml(lang.language.languageName)}
            </div>
            <div style="background:#f7fafc;border:2px solid #e2e8f0;border-radius:16px;padding:2rem;
              min-height:200px;white-space:pre-line;font-size:1.05rem;line-height:1.8;color:#2d3748;
              box-shadow:0 2px 8px rgba(0,0,0,.04);">${escapeHtml(lang.instructions)}</div>
          </div>`;
        if (idx === 0 && isMulti) {
          instructionsHtml += `<div style="width:1px;background-color:#e2e8f0;align-self:stretch;"></div>`;
        }
      });
      instructionsHtml += '</div>';
    } else {
      // Fallback instructions
      const items = [
        { icon: '📝', text: 'This is <strong style="color:#667eea">NOT a school exam</strong>. You won\'t get a "grade" like A or B.' },
        { icon: '💭', text: 'There are <strong style="color:#667eea">no wrong answers</strong>. We just want to see how you think and how you feel.' },
        { icon: '✨', text: 'Just <strong style="color:#667eea">be yourself</strong>! Some parts are games and some are questions. Take your time and have fun!' },
      ];
      instructionsHtml = '<div style="display:flex;flex-direction:column;gap:1.5rem;margin-bottom:3rem;">';
      items.forEach(item => {
        instructionsHtml += `
          <div style="background:linear-gradient(135deg,rgba(102,126,234,.06) 0%,rgba(118,75,162,.06) 100%);
            border:2px solid rgba(102,126,234,.2);border-radius:16px;padding:1.5rem;
            display:flex;align-items:flex-start;gap:1.25rem;">
            <div style="width:50px;height:50px;min-width:50px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              border-radius:12px;display:flex;align-items:center;justify-content:center;
              font-size:1.75rem;box-shadow:0 4px 12px rgba(102,126,234,.3);">${item.icon}</div>
            <div style="flex:1;padding-top:.25rem;">
              <p style="margin:0;color:#2d3748;font-size:1.5rem;line-height:1.7;font-weight:500;">${item.text}</p>
            </div>
          </div>`;
      });
      instructionsHtml += '</div>';
    }

    const cardWidth = isMulti ? '1000px' : '800px';

    $('#app-root').html(`
      <div style="min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        display:flex;align-items:center;justify-content:center;padding:2rem 1rem;color-scheme:light;">
        <div class="card shadow-lg" style="width:${cardWidth};max-width:98%;border-radius:24px;border:none;background:#fff;">
          <div class="card-body p-5" style="background:#fff;color:#2d3748;border-radius:24px;">

            <!-- Icon -->
            <div style="width:100px;height:100px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              border-radius:50%;display:flex;align-items:center;justify-content:center;
              margin:0 auto 2rem;box-shadow:0 4px 15px rgba(102,126,234,.4);">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>

            <h2 class="text-center mb-2" style="font-size:2.5rem;font-weight:700;color:#2d3748;line-height:1.2;">
              General Instructions
            </h2>
            <p class="text-center mb-5" style="color:#718096;font-size:1.1rem;margin-top:1rem;">
              Please read the instructions carefully before proceeding
            </p>

            ${instructionsHtml}

            <!-- Info box -->
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

            <!-- Start button -->
            <div class="text-center">
              <button id="start-btn" class="btn"
                style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;
                padding:1.15rem 4rem;border-radius:14px;font-size:1.2rem;font-weight:600;border:none;
                box-shadow:0 4px 15px rgba(102,126,234,.4);transition:all .3s ease;
                display:inline-flex;align-items:center;gap:.75rem;">
                <span>I'm Ready to Start!</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>

            <p class="text-center mt-4" style="color:#9ca3af;font-size:.9rem;margin:1.5rem 0 0 0;">
              Click the button above when you're ready to begin your journey
            </p>
          </div>
        </div>
      </div>
    `);

    $('#start-btn')
      .on('mouseenter', function() {
        $(this).css({ transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(102,126,234,.5)' });
      })
      .on('mouseleave', function() {
        $(this).css({ transform: 'translateY(0)', boxShadow: '0 4px 15px rgba(102,126,234,.4)' });
      })
      .on('click', function() {
        Router.navigate('studentAssessment');
      });
  }
};
