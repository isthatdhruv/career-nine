// Career-9 Assessment - Section Question Page (most complex)
Pages.sectionQuestion = {
  // ── State ────────────────────────────────────────────────────────────────
  _sectionId: null,
  _questionIndex: 0,
  _questionnaire: null,
  _questions: [],
  _currentSection: null,
  _languages: [],
  _timerInterval: null,
  _elapsedTime: 0,
  _showTimer: true,
  _isGameActive: false,
  _activeGameCode: null,

  // Persisted to localStorage
  _answers: {},           // sectionId -> questionId -> optionId[]
  _rankingAnswers: {},    // sectionId -> questionId -> optionId -> rank
  _textAnswers: {},       // sectionId -> questionId -> inputIdx -> text
  _savedForLater: {},     // sectionId -> Set<questionId>
  _skipped: {},           // sectionId -> Set<questionId>
  _completedGames: {},    // gameCode -> bool
  _seenSectionInstructions: new Set(),

  // ── Entry point ──────────────────────────────────────────────────────────
  render(sectionId, questionIndex) {
    preventReload();
    this._sectionId = sectionId;
    this._questionIndex = parseInt(questionIndex) || 0;

    // Load from state
    const questionnaire = AppState.assessmentData && AppState.assessmentData[0];
    if (!questionnaire) {
      $('#app-root').html('<div class="text-center mt-5 text-white">No questions found</div>');
      return;
    }

    this._questionnaire = questionnaire;
    this._languages = questionnaire.languages || [];
    this._showTimer = AppState.assessmentConfig?.showTimer !== false;

    const section = questionnaire.sections.find(
      s => String(s.section.sectionId) === String(sectionId)
    );
    if (!section) {
      $('#app-root').html('<div class="text-center mt-5 text-white">Section not found</div>');
      return;
    }
    this._currentSection = section;
    this._questions = section.questions || [];

    // Load persisted state
    this._loadFromStorage();

    // Render the layout once
    this._renderLayout();

    // Show section instruction popup if new section
    this._checkSectionInstruction(sectionId);

    // Start or continue timer
    this._startTimer();

    // Initialize proctoring (no-op if already initialized)
    if (typeof Proctoring !== 'undefined') Proctoring.init();
  },

  _loadFromStorage() {
    const parse = (key, fallback) => {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    };
    this._answers = parse('assessmentAnswers', {});
    this._rankingAnswers = parse('assessmentRankingAnswers', {});
    this._textAnswers = parse('assessmentTextAnswers', {});
    this._completedGames = parse('assessmentCompletedGames', {});
    this._elapsedTime = parseInt(localStorage.getItem('assessmentElapsedTime') || '0');

    // Convert arrays back to Sets
    const sfl = parse('assessmentSavedForLater', {});
    this._savedForLater = {};
    for (const k in sfl) this._savedForLater[k] = new Set(sfl[k]);

    const sk = parse('assessmentSkipped', {});
    this._skipped = {};
    for (const k in sk) this._skipped[k] = new Set(sk[k]);

    const seen = parse('assessmentSeenSectionInstructions', []);
    this._seenSectionInstructions = new Set(seen);
  },

  _saveToStorage() {
    const sfl = {};
    for (const k in this._savedForLater) sfl[k] = Array.from(this._savedForLater[k]);
    const sk = {};
    for (const k in this._skipped) sk[k] = Array.from(this._skipped[k]);

    localStorage.setItem('assessmentAnswers', JSON.stringify(this._answers));
    localStorage.setItem('assessmentRankingAnswers', JSON.stringify(this._rankingAnswers));
    localStorage.setItem('assessmentTextAnswers', JSON.stringify(this._textAnswers));
    localStorage.setItem('assessmentSavedForLater', JSON.stringify(sfl));
    localStorage.setItem('assessmentSkipped', JSON.stringify(sk));
    localStorage.setItem('assessmentElapsedTime', String(this._elapsedTime));
    localStorage.setItem('assessmentCompletedGames', JSON.stringify(this._completedGames));
    localStorage.setItem('assessmentSeenSectionInstructions', JSON.stringify(Array.from(this._seenSectionInstructions)));
  },

  // ── Timer ────────────────────────────────────────────────────────────────
  _startTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      this._elapsedTime++;
      localStorage.setItem('assessmentElapsedTime', String(this._elapsedTime));
      if (this._showTimer) $('#timer-display').text('⏱️ ' + formatTime(this._elapsedTime));
    }, 1000);
  },

  _stopTimer() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  },

  // ── Layout ───────────────────────────────────────────────────────────────
  _renderLayout() {
    $('#app-root').html(`
      <div style="display:flex;min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color-scheme:light;">
        <!-- SIDEBAR -->
        <div class="question-sidebar" id="sidebar">
          <div style="border-bottom:2px solid #e2e8f0;padding:16px 20px;
            background:linear-gradient(135deg,rgba(102,126,234,.08) 0%,rgba(118,75,162,.08) 100%);">
            <div style="display:flex;justify-content:center;margin-bottom:12px;">
              <img src="/media/logos/kcc.jpg" alt="Logo" style="height:48px;object-fit:contain;">
            </div>
            <h6 style="font-size:.85rem;font-weight:700;color:#2d3748;margin-bottom:10px;
              display:flex;align-items:center;gap:8px;">
              <span style="width:6px;height:18px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:3px;display:inline-block;"></span>
              Legend
            </h6>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;">
              <div class="d-flex align-items-center gap-2">
                <div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);flex-shrink:0;"></div>
                <span style="font-size:.8rem;color:#4a5568;font-weight:500;">Answered</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);flex-shrink:0;"></div>
                <span style="font-size:.8rem;color:#4a5568;font-weight:500;">Saved</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#f87171 0%,#dc2626 100%);flex-shrink:0;"></div>
                <span style="font-size:.8rem;color:#4a5568;font-weight:500;">Skipped</span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div style="width:14px;height:14px;border-radius:50%;background:#d1d5db;flex-shrink:0;border:2px solid #9ca3af;"></div>
                <span style="font-size:.8rem;color:#4a5568;font-weight:500;">Not Visited</span>
              </div>
            </div>
          </div>
          <div style="flex:1;overflow-y:auto;padding:20px;" id="question-nav"></div>
        </div>

        <!-- MAIN QUESTION AREA -->
        <div class="question-main">
          <div id="question-card" style="width:auto;min-width:900px;max-width:1200px;border-radius:24px;
            border:none;box-shadow:0 20px 60px rgba(0,0,0,.15);background:#fff;color-scheme:light;color:#2d3748;padding:40px;">
          </div>
        </div>
      </div>

      <!-- Submit Warning Modal -->
      <div id="warning-modal" class="modal-overlay" style="display:none;">
        <div style="background:#fff;border-radius:16px;padding:32px 36px;max-width:440px;width:90%;
          text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);color:#2d3748;" onclick="event.stopPropagation()">
          <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);
            display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;">⚠️</div>
          <h5 style="font-weight:700;margin-bottom:12px;color:#1a202c;font-size:1.2rem;">Mark all answers before saving</h5>
          <p style="color:#6b7280;font-size:.95rem;line-height:1.6;margin-bottom:24px;">
            Some questions are still unanswered, saved for later, or skipped. Please answer all questions before submitting.
          </p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button id="close-warning" style="background:#e2e8f0;color:#4a5568;border:none;border-radius:10px;
              padding:10px 24px;font-weight:600;font-size:.95rem;cursor:pointer;">Close</button>
            <button id="goto-unanswered" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              color:#fff;border:none;border-radius:10px;padding:10px 24px;font-weight:600;font-size:.95rem;
              cursor:pointer;box-shadow:0 4px 15px rgba(102,126,234,.4);">Continue →</button>
          </div>
        </div>
      </div>

      <!-- Section instruction popup -->
      <div id="section-instruction-modal" class="modal-overlay" style="display:none;">
        <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:600px;width:90%;
          max-height:80vh;overflow-y:auto;color:#2d3748;" onclick="event.stopPropagation()">
          <h5 style="font-weight:700;margin-bottom:16px;color:#2d3748;">Section Instructions</h5>
          <div id="section-instruction-texts"></div>
          <div style="text-align:right;margin-top:20px;">
            <button id="close-section-instruction" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
              color:#fff;border:none;border-radius:8px;padding:8px 28px;font-weight:600;font-size:.95rem;cursor:pointer;">OK</button>
          </div>
        </div>
      </div>
    `);

    // Render sidebar nav and question content
    this._renderSidebar();
    this._renderQuestion();

    // Wire modal buttons
    const self = this;
    $('#close-warning').on('click', () => $('#warning-modal').hide());
    $('#warning-modal').on('click', () => $('#warning-modal').hide());
    $('#goto-unanswered').on('click', () => {
      $('#warning-modal').hide();
      const next = self._findNextUnanswered(self._questionnaire.sections[0].section.sectionId.toString(), -1);
      if (next) Router.navigate(`studentAssessment/sections/${next.sectionId}/questions/${next.questionIndex}`);
    });
    $('#close-section-instruction').on('click', () => $('#section-instruction-modal').hide());
    $('#section-instruction-modal').on('click', () => $('#section-instruction-modal').hide());
  },

  // ── Section instruction popup ─────────────────────────────────────────────
  _checkSectionInstruction(sectionId) {
    if (this._seenSectionInstructions.has(sectionId)) return;

    const section = this._questionnaire.sections.find(
      s => String(s.section.sectionId) === String(sectionId)
    );
    this._seenSectionInstructions.add(sectionId);
    localStorage.setItem('assessmentSeenSectionInstructions', JSON.stringify(Array.from(this._seenSectionInstructions)));

    if (!section?.instruction?.length) return;
    const texts = section.instruction
      .filter(inst => inst.instructionText && !isNA(inst.instructionText))
      .map(inst => ({ text: inst.instructionText, language: inst.language?.languageName || 'English' }));

    if (!texts.length) return;

    let html = '';
    texts.forEach((item, idx) => {
      html += `
        <div style="margin-bottom:${idx < texts.length - 1 ? '16px' : '0'};">
          ${texts.length > 1 ? `<div style="font-size:.85rem;font-weight:600;color:#667eea;margin-bottom:6px;">${escapeHtml(item.language)}</div>` : ''}
          <p style="white-space:pre-line;line-height:1.7;margin:0;font-size:1rem;color:#4a5568;">${escapeHtml(item.text)}</p>
        </div>`;
    });
    $('#section-instruction-texts').html(html);
    $('#section-instruction-modal').show();
  },

  // ── Sidebar ──────────────────────────────────────────────────────────────
  _renderSidebar() {
    const self = this;
    let html = `<h6 style="font-size:.95rem;font-weight:700;color:#2d3748;margin-bottom:16px;
      display:flex;align-items:center;gap:8px;">
      <span style="width:6px;height:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:3px;display:inline-block;"></span>
      Question Status
    </h6>`;

    this._questionnaire.sections.forEach(sec => {
      const secId = String(sec.section.sectionId);
      html += `<div class="mb-4">
        <div style="font-size:.9rem;font-weight:600;color:#4a5568;margin-bottom:10px;padding:6px 12px;
          background:rgba(102,126,234,.08);border-radius:8px;border-left:3px solid #667eea;">
          ${escapeHtml(sec.section.sectionName)}
        </div>
        <div class="d-flex flex-wrap gap-2">`;

      sec.questions.forEach((q, i) => {
        const bg = self._getQuestionColor(secId, q.questionnaireQuestionId);
        const isCurrent = secId === self._sectionId && i === self._questionIndex;
        const border = isCurrent ? '2px solid #fff' : '2px solid transparent';
        html += `<button class="q-nav-dot" data-section="${secId}" data-idx="${i}"
          style="background:${bg};border:${border};box-shadow:${isCurrent ? '0 0 0 2px #667eea' : 'none'};">
          ${i + 1}
        </button>`;
      });

      html += '</div></div>';
    });

    $('#question-nav').html(html);

    $(document).off('click', '.q-nav-dot').on('click', '.q-nav-dot', function() {
      const secId = $(this).data('section');
      const idx = $(this).data('idx');
      self._stopTimer();
      Router.navigate(`studentAssessment/sections/${secId}/questions/${idx}`);
    });
  },

  _getQuestionColor(secId, questionId) {
    const secIdStr = String(secId);
    const qIdNum = questionId;
    if ((this._answers[secIdStr]?.[qIdNum] || []).length) return 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
    if (Object.keys(this._rankingAnswers[secIdStr]?.[qIdNum] || {}).length) return 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
    if (Object.values(this._textAnswers[secIdStr]?.[qIdNum] || {}).some(t => t.trim())) return 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
    if (this._savedForLater[secIdStr]?.has(qIdNum)) return 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)';
    if (this._skipped[secIdStr]?.has(qIdNum)) return 'linear-gradient(135deg,#f87171 0%,#dc2626 100%)';
    return '#d1d5db';
  },

  // ── Question render ───────────────────────────────────────────────────────
  _renderQuestion() {
    const self = this;
    if (!this._questions.length) {
      $('#question-card').html('<div class="text-center">No questions found</div>');
      return;
    }

    const question = this._questions[this._questionIndex];
    if (!question) return;
    const qId = question.questionnaireQuestionId;
    const q = question.question;

    // Check if game is completed for this question
    const isGameQuestion = q.options.some(o => o.isGame);
    const isRankingQuestion = q.questionType === 'ranking';
    const isTextQuestion = q.questionType === 'text' || q.isMQTtyped === true;

    // Available languages (filter to those with actual translations for this question)
    const availableLangs = this._languages.filter(lang => {
      if (lang.language.languageId === 100) return true;
      return q.languageQuestions?.some(lq => lq.language.languageId === lang.language.languageId);
    });
    const isMultiLang = availableLangs.length > 1;

    // Question text (multi-lang)
    let questionTextHtml = '';
    if (availableLangs.length > 0) {
      questionTextHtml = `<div style="display:grid;grid-template-columns:${isMultiLang ? '1fr 1px 1fr' : '1fr'};gap:20px;margin-bottom:30px;">`;
      availableLangs.forEach((lang, idx) => {
        const text = lang.language.languageId === 100 ? q.questionText :
          (q.languageQuestions?.find(lq => lq.language.languageId === lang.language.languageId)?.questionText || q.questionText);
        questionTextHtml += `<div style="font-size:1.2rem;line-height:1.7;white-space:pre-line;color:#1a202c;font-weight:500;">${escapeHtml(text)}</div>`;
        if (idx === 0 && isMultiLang) questionTextHtml += `<div style="width:1px;background:#dee2e6;"></div>`;
      });
      questionTextHtml += '</div>';
    } else {
      questionTextHtml = `<h4 style="font-size:1.2rem;color:#1a202c;font-weight:500;margin-bottom:1.5rem;">${escapeHtml(q.questionText)}</h4>`;
    }

    // Max options hint
    let hintText = '';
    if (isTextQuestion) {
      hintText = `Please type your response(s) below. You can enter up to <strong>${q.maxOptionsAllowed || 1}</strong> response(s).`;
    } else if (isRankingQuestion) {
      hintText = `Please rank <strong>${q.maxOptionsAllowed}</strong> option(s) in order of preference (1 = most important).`;
    } else if (q.maxOptionsAllowed > 0) {
      hintText = `You can select up to <strong>${q.maxOptionsAllowed}</strong> option(s).`;
    }

    // Options HTML
    let optionsHtml = '';
    if (isTextQuestion) {
      optionsHtml = this._renderTextOptions(qId, q);
    } else if (isRankingQuestion) {
      optionsHtml = this._renderRankingOptions(qId, q, availableLangs, isMultiLang);
    } else if (isGameQuestion) {
      optionsHtml = this._renderGameOptions(qId, q, availableLangs, isMultiLang);
    } else {
      optionsHtml = this._renderChoiceOptions(qId, q, availableLangs, isMultiLang);
    }

    const isLast = this._isLastQuestionOfLastSection();
    const allAnswered = this._areAllQuestionsAnswered();

    $('#question-card').html(`
      <!-- Section badge -->
      <div class="mb-3">
        <span style="background:linear-gradient(135deg,rgba(102,126,234,.15) 0%,rgba(118,75,162,.15) 100%);
          color:#667eea;padding:8px 20px;border-radius:30px;font-size:.9rem;font-weight:600;
          display:inline-block;border:1px solid rgba(102,126,234,.3);">
          ${escapeHtml(this._currentSection?.section?.sectionName || '')}
        </span>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-4">
        <h6 style="color:#2d3748;font-weight:700;margin:0;font-size:1.1rem;">
          Question ${this._questionIndex + 1} of ${this._questions.length}
        </h6>
        ${this._showTimer ? `
        <div id="timer-display" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
          padding:10px 24px;border-radius:30px;font-weight:700;font-size:1rem;color:white;
          box-shadow:0 4px 15px rgba(102,126,234,.4);">
          ⏱️ ${formatTime(this._elapsedTime)}
        </div>` : ''}
      </div>

      <div data-proctoring="question-text">${questionTextHtml}</div>

      ${hintText ? `<div class="text-muted mb-3"><small style="font-size:1.1rem;color:#4a5568;font-weight:500;">${hintText}</small></div>` : ''}

      <div class="mt-4" id="options-container">${optionsHtml}</div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:12px;margin-top:32px;flex-wrap:wrap;align-items:center;">
        ${this._questionIndex > 0 ? `
        <button id="btn-back" style="background:#e2e8f0;color:#4a5568;border:none;border-radius:12px;
          padding:12px 24px;font-weight:600;font-size:1rem;cursor:pointer;transition:all .2s ease;">
          ← Back
        </button>` : ''}
        <button id="btn-save-later" style="background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);
          color:white;border:none;border-radius:12px;padding:12px 24px;font-weight:600;font-size:1rem;
          cursor:pointer;box-shadow:0 4px 15px rgba(251,191,36,.3);transition:all .2s ease;">
          Save for Later
        </button>
        ${isLast ? `
        <button id="btn-submit" style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);
          color:white;border:none;border-radius:12px;padding:12px 28px;font-weight:700;font-size:1rem;
          cursor:pointer;box-shadow:0 4px 15px rgba(16,185,129,.4);transition:all .2s ease;margin-left:auto;">
          Submit Assessment ✓
        </button>` : `
        <button id="btn-next" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
          color:white;border:none;border-radius:12px;padding:12px 28px;font-weight:600;font-size:1rem;
          cursor:pointer;box-shadow:0 4px 15px rgba(102,126,234,.4);transition:all .2s ease;margin-left:auto;">
          Next →
        </button>`}
      </div>
    `);

    // Bind action buttons
    $('#btn-back').on('click', () => self._goBack());
    $('#btn-save-later').on('click', () => self._saveForLater(qId));
    $('#btn-next').on('click', () => self._goNext(qId));
    $('#btn-submit').on('click', () => self._handleSubmit());

    // Bind option clicks
    if (!isTextQuestion && !isRankingQuestion && !isGameQuestion) {
      $(document).off('click', '.option-btn').on('click', '.option-btn', function() {
        const optId = parseInt($(this).data('optid'));
        self._toggleOption(qId, optId, q);
      });
    }

    if (isRankingQuestion) {
      $(document).off('change', '.rank-select').on('change', '.rank-select', function() {
        const optId = parseInt($(this).data('optid'));
        const rank = parseInt($(this).val()) || null;
        self._handleRankChange(qId, optId, rank, q);
      });
    }

    if (isTextQuestion) {
      $(document).off('input', '.text-answer-input').on('input', '.text-answer-input', function() {
        const inputIdx = parseInt($(this).data('inputidx'));
        const val = $(this).val();
        self._setTextAnswer(qId, inputIdx, val);
        self._updateAutocomplete(qId, inputIdx, val, q.options);
      });
      $(document).off('focus', '.text-answer-input').on('focus', '.text-answer-input', function() {
        const inputIdx = parseInt($(this).data('inputidx'));
        const val = $(this).val();
        self._updateAutocomplete(qId, inputIdx, val, q.options);
      });
      $(document).off('blur', '.text-answer-input').on('blur', '.text-answer-input', function() {
        setTimeout(() => $(`.autocomplete-dropdown`).hide(), 200);
      });
    }

    if (isGameQuestion) {
      $(document).off('click', '.launch-game-btn').on('click', '.launch-game-btn', function() {
        const gameCode = parseInt($(this).data('gamecode'));
        self._launchGame(qId, gameCode);
      });
    }

    // Start proctoring data collection for this question
    if (typeof Proctoring !== 'undefined') Proctoring.startQuestion(qId);
  },

  // ── Option renderers ──────────────────────────────────────────────────────
  _renderChoiceOptions(qId, q, availableLangs, isMultiLang) {
    const secId = this._sectionId;
    const selected = this._answers[secId]?.[qId] || [];
    let html = '';
    q.options.forEach((opt, optIdx) => {
      const isSelected = selected.includes(opt.optionId);

      // Render option content
      let contentHtml = '';
      if (opt.optionImageBase64 && opt.optionImageBase64.trim()) {
        const src = opt.optionImageBase64.startsWith('data:') ? opt.optionImageBase64 : `data:image/png;base64,${opt.optionImageBase64}`;
        contentHtml = `<img src="${src}" alt="${escapeHtml(opt.optionText || '')}"
          style="max-width:200px;max-height:150px;object-fit:contain;border-radius:8px;border:1px solid #e0e0e0;">`;
      } else if (isMultiLang && availableLangs.length > 0) {
        const parts = availableLangs.map((lang, i) => {
          const text = lang.language.languageId === 100 ? opt.optionText :
            (opt.languageOptions?.find(lo => lo.language.languageId === lang.language.languageId)?.optionText || opt.optionText);
          return `<div style="flex:1;">${escapeHtml(text)}
            ${opt.optionDescription ? `<div style="font-size:.85rem;color:#9ca3af;margin-top:4px;font-style:italic;">${escapeHtml(opt.optionDescription)}</div>` : ''}
          </div>` + (i === 0 ? '<div style="width:1px;background:#dee2e6;margin:0 10px;"></div>' : '');
        }).join('');
        contentHtml = `<div style="display:flex;align-items:flex-start;gap:10px;">${parts}</div>`;
      } else {
        contentHtml = `<span>${escapeHtml(opt.optionText)}</span>
          ${opt.optionDescription ? `<div style="font-size:.85rem;color:#9ca3af;margin-top:4px;font-style:italic;">${escapeHtml(opt.optionDescription)}</div>` : ''}`;
      }

      html += `
        <button class="option-btn ${isSelected ? 'selected' : ''}" data-optid="${opt.optionId}" data-proctoring-option-id="${opt.optionId}"
          style="width:100%;text-align:left;padding:1rem 1.25rem;border-radius:12px;
          border:2px solid ${isSelected ? '#667eea' : '#e2e8f0'};
          background:${isSelected ? 'linear-gradient(135deg,rgba(102,126,234,.08) 0%,rgba(118,75,162,.08) 100%)' : 'white'};
          cursor:pointer;transition:all .2s ease;margin-bottom:.75rem;color:#2d3748;
          display:flex;align-items:center;gap:1rem;">
          <div style="width:28px;height:28px;min-width:28px;border-radius:8px;
            background:${isSelected ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#f3f4f6'};
            display:flex;align-items:center;justify-content:center;
            color:${isSelected ? 'white' : '#6b7280'};font-size:.85rem;font-weight:700;">
            ${optIdx + 1}
          </div>
          <div style="flex:1;">${contentHtml}</div>
        </button>`;
    });
    return html;
  },

  _renderRankingOptions(qId, q, availableLangs, isMultiLang) {
    const secId = this._sectionId;
    const rankings = this._rankingAnswers[secId]?.[qId] || {};
    let html = '';
    q.options.forEach((opt) => {
      const currentRank = rankings[opt.optionId] || '';
      const maxRanks = q.maxOptionsAllowed || q.options.length;
      let rankOptions = '<option value="">-</option>';
      for (let r = 1; r <= maxRanks; r++) rankOptions += `<option value="${r}" ${currentRank === r ? 'selected' : ''}>${r}</option>`;

      const text = opt.optionText;
      html += `
        <div data-proctoring-option-id="${opt.optionId}" style="display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;border-radius:12px;
          border:2px solid #e2e8f0;background:white;margin-bottom:.75rem;">
          <select class="rank-select form-select" data-optid="${opt.optionId}"
            style="width:80px;border-radius:8px;">
            ${rankOptions}
          </select>
          <div style="flex:1;font-size:1rem;color:#2d3748;">${escapeHtml(text)}</div>
        </div>`;
    });
    return html;
  },

  _renderGameOptions(qId, q, availableLangs, isMultiLang) {
    const secId = this._sectionId;
    const selected = this._answers[secId]?.[qId] || [];
    let html = '';
    q.options.forEach((opt) => {
      if (opt.isGame && opt.game) {
        const isCompleted = this._completedGames[opt.game.gameCode];
        const isSelected = selected.includes(opt.optionId);
        html += `
          <div style="border:1px solid #dee2e6;background:#faf5ff;border-radius:12px;padding:1.25rem;margin-bottom:.75rem;">
            <div style="font-weight:700;color:#2d3748;margin-bottom:.75rem;font-size:1.1rem;">
              🎮 ${escapeHtml(opt.game.gameName)}
            </div>
            <div style="font-size:1rem;color:#4a5568;margin-bottom:1rem;">${escapeHtml(opt.optionText)}</div>
            ${isCompleted || isSelected ? `
              <div style="background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);border:1px solid #10b981;
                border-radius:8px;padding:.75rem 1rem;display:flex;align-items:center;gap:.5rem;">
                <span style="color:#059669;font-weight:700;">✓ Game Completed!</span>
              </div>` : `
              <button class="launch-game-btn btn" data-gamecode="${opt.game.gameCode}"
                style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;
                border-radius:10px;padding:.75rem 1.5rem;font-weight:600;font-size:.95rem;
                box-shadow:0 4px 15px rgba(102,126,234,.4);">
                🎮 Play Game
              </button>`}
          </div>`;
      } else {
        html += `<div style="padding:1rem;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:.75rem;color:#2d3748;">
          ${escapeHtml(opt.optionText)}</div>`;
      }
    });
    return html;
  },

  _renderTextOptions(qId, q) {
    const secId = this._sectionId;
    const maxInputs = q.maxOptionsAllowed || 1;
    const currentTexts = this._textAnswers[secId]?.[qId] || {};
    let html = '';
    for (let i = 0; i < maxInputs; i++) {
      html += `
        <div class="mb-3" style="position:relative;">
          <label class="fw-bold mb-1" style="font-size:1rem;color:#4a5568;">Response ${i + 1}:</label>
          <input type="text" class="form-control form-control-lg text-answer-input"
            data-inputidx="${i}" value="${escapeHtml(currentTexts[i] || '')}"
            placeholder="Type your answer..."
            autocomplete="off"
            style="font-size:1.1rem;padding:12px 16px;border-color:#dee2e6;">
          <div class="autocomplete-dropdown" id="autocomplete-${qId}-${i}" style="display:none;"></div>
        </div>`;
    }
    return html;
  },

  _updateAutocomplete(qId, inputIdx, value, options) {
    const secId = this._sectionId;
    const currentTexts = this._textAnswers[secId]?.[qId] || {};
    const inputVal = value.toLowerCase();
    const $drop = $(`#autocomplete-${qId}-${inputIdx}`);

    const suggestions = options.filter(opt => {
      const text = (opt.optionText || '').toLowerCase();
      const usedElsewhere = Object.entries(currentTexts).some(([idx, v]) =>
        Number(idx) !== inputIdx && v.trim().toLowerCase() === text
      );
      if (usedElsewhere) return false;
      if (inputVal.length < 4) return true;
      return text.includes(inputVal);
    });

    const thisBoxVal = value.trim().toLowerCase();
    const exactMatch = suggestions.length === 1 && suggestions[0].optionText?.toLowerCase() === thisBoxVal;

    if (!suggestions.length || exactMatch) {
      $drop.hide();
      return;
    }

    const self = this;
    let html = '';
    suggestions.forEach(opt => {
      const text = opt.optionText || '';
      const matchIdx = text.toLowerCase().indexOf(inputVal);
      let displayText = escapeHtml(text);
      if (matchIdx >= 0 && inputVal.length > 0) {
        displayText = escapeHtml(text.slice(0, matchIdx)) +
          `<strong>${escapeHtml(text.slice(matchIdx, matchIdx + inputVal.length))}</strong>` +
          escapeHtml(text.slice(matchIdx + inputVal.length));
      }
      html += `<div class="autocomplete-item" data-value="${escapeHtml(text)}" data-inputidx="${inputIdx}" data-qid="${qId}">${displayText}</div>`;
    });
    $drop.html(html).show();

    $(document).off('mousedown', '.autocomplete-item').on('mousedown', '.autocomplete-item', function(e) {
      e.preventDefault();
      const val = $(this).data('value');
      const idx = parseInt($(this).data('inputidx'));
      const questionId = parseInt($(this).data('qid'));
      $(`.text-answer-input[data-inputidx="${idx}"]`).val(val);
      self._setTextAnswer(questionId, idx, val);
      $drop.hide();
    });
  },

  // ── Answer management ─────────────────────────────────────────────────────
  _toggleOption(qId, optionId, q) {
    const secId = this._sectionId;
    this._answers[secId] = this._answers[secId] || {};
    const arr = this._answers[secId][qId] || [];
    const maxAllowed = q.maxOptionsAllowed;
    const isSelected = arr.includes(optionId);
    const currentCount = arr.length;

    let willAutoAdvance = false;

    if (isSelected) {
      this._answers[secId][qId] = arr.filter(x => x !== optionId);
    } else if (maxAllowed === 0 || arr.length < maxAllowed) {
      this._answers[secId][qId] = [...arr, optionId];
      if (maxAllowed > 0 && (currentCount + 1) === maxAllowed) willAutoAdvance = true;
    }

    // Remove from skipped
    if (!this._skipped[secId]) this._skipped[secId] = new Set();
    this._skipped[secId].delete(qId);

    this._saveToStorage();
    this._renderSidebar();
    this._refreshOptionStyles(qId, q.options);

    if (willAutoAdvance) {
      setTimeout(() => {
        const next = this._findNextUnanswered(secId, this._questionIndex, qId);
        if (next) {
          this._stopTimer();
          Router.navigate(`studentAssessment/sections/${next.sectionId}/questions/${next.questionIndex}`);
        }
      }, 400);
    }
  },

  _refreshOptionStyles(qId, options) {
    const secId = this._sectionId;
    const selected = this._answers[secId]?.[qId] || [];
    options.forEach(opt => {
      const $btn = $(`.option-btn[data-optid="${opt.optionId}"]`);
      const isSel = selected.includes(opt.optionId);
      $btn.css({
        border: `2px solid ${isSel ? '#667eea' : '#e2e8f0'}`,
        background: isSel ? 'linear-gradient(135deg,rgba(102,126,234,.08) 0%,rgba(118,75,162,.08) 100%)' : 'white'
      });
      $btn.find('> div:first-child').css({
        background: isSel ? 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' : '#f3f4f6',
        color: isSel ? 'white' : '#6b7280'
      });
    });
  },

  _handleRankChange(qId, optionId, rank, q) {
    const secId = this._sectionId;
    this._rankingAnswers[secId] = this._rankingAnswers[secId] || {};
    this._rankingAnswers[secId][qId] = this._rankingAnswers[secId][qId] || {};

    const currentCount = Object.keys(this._rankingAnswers[secId][qId]).length;
    const maxAllowed = q.maxOptionsAllowed;
    const isAddingRank = rank !== null && !this._rankingAnswers[secId][qId][optionId];
    const willAutoAdvance = isAddingRank && (currentCount + 1) === maxAllowed;

    if (rank === null) {
      delete this._rankingAnswers[secId][qId][optionId];
    } else {
      this._rankingAnswers[secId][qId][optionId] = rank;
    }

    if (rank !== null) {
      if (!this._skipped[secId]) this._skipped[secId] = new Set();
      this._skipped[secId].delete(qId);
    }

    this._saveToStorage();
    this._renderSidebar();

    if (willAutoAdvance) {
      setTimeout(() => {
        const next = this._findNextUnanswered(secId, this._questionIndex, qId);
        if (next) {
          this._stopTimer();
          Router.navigate(`studentAssessment/sections/${next.sectionId}/questions/${next.questionIndex}`);
        }
      }, 400);
    }
  },

  _setTextAnswer(qId, inputIdx, value) {
    const secId = this._sectionId;
    this._textAnswers[secId] = this._textAnswers[secId] || {};
    this._textAnswers[secId][qId] = this._textAnswers[secId][qId] || {};
    this._textAnswers[secId][qId][inputIdx] = value;

    if (value.trim()) {
      if (!this._skipped[secId]) this._skipped[secId] = new Set();
      this._skipped[secId].delete(qId);
    }

    this._saveToStorage();
    this._renderSidebar();
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  _goBack() {
    if (this._questionIndex > 0) {
      this._stopTimer();
      Router.navigate(`studentAssessment/sections/${this._sectionId}/questions/${this._questionIndex - 1}`);
    }
  },

  _goNext(qId) {
    const secId = this._sectionId;
    const q = this._questions[this._questionIndex];
    const isTextQuestion = q?.question?.questionType === 'text' || q?.question?.isMQTtyped === true;
    const isRankingQuestion = q?.question?.questionType === 'ranking';

    // Check if question is answered
    let isAnswered = false;
    if (isTextQuestion) {
      isAnswered = Object.values(this._textAnswers[secId]?.[qId] || {}).some(t => t.trim());
    } else if (isRankingQuestion) {
      isAnswered = Object.keys(this._rankingAnswers[secId]?.[qId] || {}).length > 0;
    } else {
      isAnswered = (this._answers[secId]?.[qId] || []).length > 0;
    }

    if (!isAnswered) {
      if (!this._skipped[secId]) this._skipped[secId] = new Set();
      this._skipped[secId].add(qId);
      this._saveToStorage();
      this._renderSidebar();
    }

    const next = this._findNextUnanswered(secId, this._questionIndex);
    if (next) {
      this._stopTimer();
      Router.navigate(`studentAssessment/sections/${next.sectionId}/questions/${next.questionIndex}`);
    } else {
      this._goToNextSection();
    }
  },

  _saveForLater(qId) {
    const secId = this._sectionId;
    if (!this._savedForLater[secId]) this._savedForLater[secId] = new Set();
    this._savedForLater[secId].add(qId);

    // Clear answers
    if (this._answers[secId]) delete this._answers[secId][qId];
    if (this._rankingAnswers[secId]) delete this._rankingAnswers[secId][qId];

    this._saveToStorage();
    this._renderSidebar();

    const next = this._findNextUnanswered(secId, this._questionIndex, qId);
    if (next) {
      this._stopTimer();
      Router.navigate(`studentAssessment/sections/${next.sectionId}/questions/${next.questionIndex}`);
    }
  },

  _goToNextSection() {
    const idx = this._questionnaire.sections.findIndex(
      s => String(s.section.sectionId) === String(this._sectionId)
    );
    const next = this._questionnaire.sections[idx + 1];
    this._stopTimer();
    if (next) {
      Router.navigate(`studentAssessment/sections/${next.section.sectionId}/questions/0`);
    } else {
      Router.navigate('studentAssessment/completed');
    }
  },

  _isLastSection() {
    const idx = this._questionnaire.sections.findIndex(
      s => String(s.section.sectionId) === String(this._sectionId)
    );
    return idx === this._questionnaire.sections.length - 1;
  },

  _isLastQuestionOfLastSection() {
    return this._isLastSection() && this._questionIndex === this._questions.length - 1;
  },

  _findNextUnanswered(fromSectionId, fromQuestionIndex, excludeQuestionId) {
    const sections = this._questionnaire.sections;
    const startSectionIdx = sections.findIndex(s => String(s.section.sectionId) === String(fromSectionId));
    if (startSectionIdx === -1) return null;

    const check = (secId, q, qIdx) => {
      const qId = q.questionnaireQuestionId;
      if (excludeQuestionId && qId === excludeQuestionId) return false;
      const isText = q.question.questionType === 'text' || q.question.isMQTtyped === true;
      const isRanking = q.question.questionType === 'ranking';
      if (isText) return !Object.values(this._textAnswers[secId]?.[qId] || {}).some(t => t.trim());
      if (isRanking) return Object.keys(this._rankingAnswers[secId]?.[qId] || {}).length === 0;
      return !(this._answers[secId]?.[qId]?.length > 0);
    };

    // Search forward from current position
    for (let si = startSectionIdx; si < sections.length; si++) {
      const sec = sections[si];
      const secId = String(sec.section.sectionId);
      const startQ = si === startSectionIdx ? fromQuestionIndex + 1 : 0;
      for (let qi = startQ; qi < sec.questions.length; qi++) {
        if (check(secId, sec.questions[qi], qi)) return { sectionId: secId, questionIndex: qi };
      }
    }

    // Wrap around
    for (let si = 0; si <= startSectionIdx; si++) {
      const sec = sections[si];
      const secId = String(sec.section.sectionId);
      const endQ = si === startSectionIdx ? fromQuestionIndex : sec.questions.length;
      for (let qi = 0; qi < endQ; qi++) {
        if (check(secId, sec.questions[qi], qi)) return { sectionId: secId, questionIndex: qi };
      }
    }

    return null;
  },

  _areAllQuestionsAnswered() {
    for (const section of this._questionnaire.sections) {
      const secId = String(section.section.sectionId);
      for (const q of section.questions) {
        const qId = q.questionnaireQuestionId;
        const isText = q.question.questionType === 'text' || q.question.isMQTtyped === true;
        const isRanking = q.question.questionType === 'ranking';
        let isAnswered = false;
        if (isText) isAnswered = Object.values(this._textAnswers[secId]?.[qId] || {}).some(t => t.trim());
        else if (isRanking) isAnswered = Object.keys(this._rankingAnswers[secId]?.[qId] || {}).length > 0;
        else isAnswered = (this._answers[secId]?.[qId] || []).length > 0;
        if (!isAnswered) return false;
      }
    }
    return true;
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  async _handleSubmit() {
    if (!this._areAllQuestionsAnswered()) {
      $('#warning-modal').show();
      return;
    }

    const submissionData = this._generateSubmissionJSON();
    const $btn = $('#btn-submit');
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Submitting...');

    try {
      await API.submitAnswers(submissionData);
      this._stopTimer();

      // Submit proctoring data — fire-and-forget, must not block completion
      if (typeof Proctoring !== 'undefined') {
        try {
          const _pUid = parseInt(localStorage.getItem('userStudentId')) || null;
          const _pAid = parseInt(localStorage.getItem('assessmentId')) || null;
          if (_pUid && _pAid) Proctoring.submitProctoring(_pUid, _pAid);
          Proctoring.stop();
        } catch (_pe) {
          console.warn('[Proctoring] Submit/stop error (non-fatal):', _pe);
        }
      }

      Router.navigate('studentAssessment/completed');
    } catch (err) {
      console.error('Error submitting assessment:', err);
      alert('Failed to submit assessment. Please try again.');
      $btn.prop('disabled', false).text('Submit Assessment ✓');
    }
  },

  _generateSubmissionJSON() {
    const answersList = [];

    for (const section of this._questionnaire.sections) {
      const secId = String(section.section.sectionId);
      for (const q of section.questions) {
        const qId = q.questionnaireQuestionId;
        const isText = q.question.questionType === 'text' || q.question.isMQTtyped === true;
        const isRanking = q.question.questionType === 'ranking';

        if (isText) {
          const texts = this._textAnswers[secId]?.[qId] || {};
          const questionOptions = q.question.options || [];
          for (const text of Object.values(texts)) {
            const trimmed = text.trim();
            if (!trimmed) continue;
            const normalised = trimmed.replace(/\s+/g, ' ').toLowerCase();
            const matched = questionOptions.find(
              opt => (opt.optionText || '').trim().replace(/\s+/g, ' ').toLowerCase() === normalised
            );
            if (matched) {
              answersList.push({ questionnaireQuestionId: qId, optionId: matched.optionId });
            } else {
              answersList.push({ questionnaireQuestionId: qId, textResponse: trimmed });
            }
          }
        } else if (isRanking) {
          const rankings = this._rankingAnswers[secId]?.[qId] || {};
          for (const [optIdStr, rank] of Object.entries(rankings)) {
            answersList.push({ questionnaireQuestionId: qId, optionId: parseInt(optIdStr), rankOrder: rank });
          }
        } else {
          const selectedIds = this._answers[secId]?.[qId] || [];
          for (const optId of selectedIds) {
            answersList.push({ questionnaireQuestionId: qId, optionId: optId });
          }
        }
      }
    }

    return {
      userStudentId: parseInt(localStorage.getItem('userStudentId')) || null,
      assessmentId: parseInt(localStorage.getItem('assessmentId')) || null,
      status: 'completed',
      answers: answersList
    };
  },

  // ── Game handling ─────────────────────────────────────────────────────────
  _launchGame(qId, gameCode) {
    this._stopTimer();
    const userStudentId = localStorage.getItem('userStudentId') || '';
    const playerName = localStorage.getItem('userName') || 'Student';
    const self = this;

    GameWrapper.launch(gameCode, userStudentId, playerName,
      // onComplete
      () => {
        self._completedGames[gameCode] = true;
        // Auto-select the game option
        const question = self._questions[self._questionIndex];
        const gameOpt = question?.question?.options?.find(o => o.isGame && o.game?.gameCode === gameCode);
        if (gameOpt) {
          const secId = self._sectionId;
          self._answers[secId] = self._answers[secId] || {};
          const arr = self._answers[secId][qId] || [];
          if (!arr.includes(gameOpt.optionId)) {
            self._answers[secId][qId] = [...arr, gameOpt.optionId];
          }
          if (!self._skipped[secId]) self._skipped[secId] = new Set();
          self._skipped[secId].delete(qId);
        }
        self._saveToStorage();
        self._startTimer();
        self._renderSidebar();
        self._renderQuestion();
      },
      // onExit
      () => {
        self._startTimer();
      }
    );
  }
};
