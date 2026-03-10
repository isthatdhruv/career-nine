// Career-9 Assessment - Demographic Details Page
Pages.demographics = {
  _fields: [],
  _values: {},
  _multiValues: {},
  _errors: {},
  _touched: {},

  async render(assessmentId) {
    preventReload();
    const userStudentId = localStorage.getItem('userStudentId');
    if (!userStudentId || !assessmentId) {
      Router.navigate('student-login');
      return;
    }

    // Show loading
    $('#app-root').html(`
      <div class="page-center" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
        <div class="text-center">
          <div class="spinner-border text-light" style="width:3rem;height:3rem;"></div>
          <p class="mt-3 text-white fw-semibold">Loading your information...</p>
        </div>
      </div>
    `);

    this._fields = [];
    this._values = {};
    this._multiValues = {};
    this._errors = {};
    this._touched = {};

    try {
      const res = await API.getDemographicFields(assessmentId, userStudentId);
      const fields = res.data;
      this._fields = fields;

      // Pre-fill values
      fields.forEach(f => {
        if (f.dataType === 'SELECT_MULTI') {
          this._multiValues[f.fieldId] = f.currentValue ? f.currentValue.split(',') : [];
        } else {
          this._values[f.fieldId] = f.currentValue || f.defaultValue || '';
        }
      });

      this._renderForm(assessmentId, userStudentId);
    } catch (err) {
      console.error('Error fetching demographic fields:', err);
      $('#app-root').html(`<div class="page-center"><p class="text-white">Error loading form. Please try again.</p></div>`);
    }
  },

  _renderForm(assessmentId, userStudentId) {
    const self = this;
    const hasFields = this._fields.length > 0;

    const fieldsHtml = hasFields ? this._fields.map(f => this._renderField(f)).join('') : '';

    $('#app-root').html(`
      <div style="min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        display:flex;align-items:center;justify-content:center;padding:2rem 1rem;color-scheme:light;">
        <div class="card shadow-lg" style="width:100%;max-width:650px;border-radius:20px;border:none;background:#fff;">
          <div class="card-body p-5" style="background:#fff;color:#2d3748;border-radius:20px;">

            ${!hasFields ? `
              <div class="text-center">
                <p class="text-muted">No demographic fields configured for this assessment.</p>
                <button id="skip-demo-btn" class="btn-gradient" style="padding:.875rem 2rem;border-radius:10px;">
                  Continue to Assessment
                </button>
              </div>
            ` : `
              <div class="text-center mb-4">
                <div style="width:70px;height:70px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
                  border-radius:50%;display:flex;align-items:center;justify-content:center;
                  margin:0 auto 1rem;box-shadow:0 4px 15px rgba(102,126,234,.4);">
                  <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <h2 style="font-size:2rem;font-weight:700;color:#2d3748;margin-bottom:.5rem;">Demographic Details</h2>
                <p style="color:#718096;font-size:1rem;">Please provide your information to continue</p>
              </div>
              <form id="demo-form" novalidate>
                ${fieldsHtml}
                <button type="submit" id="demo-submit" class="btn w-100 mt-3"
                  style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:.875rem;
                  border-radius:10px;font-size:1.05rem;font-weight:600;border:none;
                  box-shadow:0 4px 15px rgba(102,126,234,.4);transition:all .3s ease;cursor:pointer;">
                  Save and Continue to Assessment
                </button>
              </form>
            `}
          </div>
        </div>
      </div>
    `);

    // Initialize form values
    this._fields.forEach(f => {
      if (f.dataType === 'SELECT_MULTI') {
        const vals = this._multiValues[f.fieldId] || [];
        vals.forEach(v => {
          $(`input[name="multi-${f.fieldId}"][value="${v}"]`).prop('checked', true);
          $(`label[data-for="multi-${f.fieldId}-${v}"]`).css({
            borderColor: '#667eea', background: '#eef2ff'
          });
        });
      } else {
        const val = this._values[f.fieldId] || '';
        $(`[data-field="${f.fieldId}"]`).val(val);
        if (f.dataType === 'SELECT_SINGLE' && f.options.length <= 4) {
          $(`input[name="radio-${f.fieldId}"][value="${val}"]`).prop('checked', true);
          this._updateRadioStyles(f.fieldId);
        }
      }
    });

    // ── Events ──────────────────────────────────────────────────────────────
    if (!hasFields) {
      $('#skip-demo-btn').on('click', async () => {
        $('#skip-demo-btn').prop('disabled', true).text('Loading...');
        try {
          await API.startAssessment(userStudentId, assessmentId);
          await fetchAndCacheAssessmentData(assessmentId);
          Router.navigate('general-instructions');
        } catch (err) {
          alert('Failed to start assessment. Please try again.');
          $('#skip-demo-btn').prop('disabled', false).text('Continue to Assessment');
        }
      });
      return;
    }

    // Radio change
    $(document).on('change', '.field-radio', function() {
      const fieldId = Number($(this).data('field'));
      self._values[fieldId] = $(this).val();
      self._updateRadioStyles(fieldId);
    });

    // Checkbox change (multi)
    $(document).on('change', '.field-checkbox', function() {
      const fieldId = Number($(this).data('field'));
      const val = $(this).val();
      const checked = $(this).is(':checked');
      self._multiValues[fieldId] = self._multiValues[fieldId] || [];
      if (checked) {
        if (!self._multiValues[fieldId].includes(val)) self._multiValues[fieldId].push(val);
      } else {
        self._multiValues[fieldId] = self._multiValues[fieldId].filter(v => v !== val);
      }
      // Update label styles
      $(`input[name="multi-${fieldId}"]`).each(function() {
        const lbl = $(`label[data-for="multi-${fieldId}-${$(this).val()}"]`);
        if ($(this).is(':checked')) lbl.css({ borderColor: '#667eea', background: '#eef2ff' });
        else lbl.css({ borderColor: '#e2e8f0', background: 'white' });
      });
    });

    // Text/number/date/select change
    $(document).on('change blur', '.field-input', function() {
      const fieldId = Number($(this).data('field'));
      self._values[fieldId] = $(this).val();
      self._touched[fieldId] = true;
    });

    // Form submit
    $('#demo-form').on('submit', async function(e) {
      e.preventDefault();

      // Collect current values
      self._fields.forEach(f => {
        if (f.dataType !== 'SELECT_MULTI' && f.dataType !== 'SELECT_SINGLE' || f.options.length > 4) {
          const val = $(`[data-field="${f.fieldId}"]`).val();
          if (val !== undefined) self._values[f.fieldId] = val;
        }
      });

      // Validate all
      let hasError = false;
      self._fields.forEach(f => {
        self._touched[f.fieldId] = true;
        const err = self._validateField(f);
        self._errors[f.fieldId] = err;
        if (err) hasError = true;
      });

      // Show errors
      self._fields.forEach(f => {
        const $err = $(`#field-err-${f.fieldId}`);
        if (self._errors[f.fieldId]) {
          $err.text(self._errors[f.fieldId]).show();
        } else {
          $err.hide();
        }
      });

      if (hasError) {
        const $first = $('.field-error:visible').first();
        if ($first.length) $first[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const $btn = $('#demo-submit');
      $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Saving...');

      try {
        const responses = self._fields.map(f => ({
          fieldId: f.fieldId,
          value: f.dataType === 'SELECT_MULTI'
            ? (self._multiValues[f.fieldId] || []).join(',')
            : self._values[f.fieldId] || ''
        }));

        await API.submitDemographics(userStudentId, assessmentId, responses);
        await API.startAssessment(userStudentId, assessmentId);
        await fetchAndCacheAssessmentData(assessmentId);
        Router.navigate('general-instructions');
      } catch (err) {
        console.error('Error submitting demographics:', err);
        const errorData = err.response?.data;
        if (errorData?.validationErrors) {
          alert('Validation errors:\n' + errorData.validationErrors.join('\n'));
        } else {
          alert(errorData?.error || 'Failed to submit. Please try again.');
        }
        $btn.prop('disabled', false).text('Save and Continue to Assessment');
      }
    });
  },

  _getLabel(field) {
    return field.customLabel || field.displayLabel;
  },

  _validateField(field) {
    const label = this._getLabel(field);
    const value = field.dataType === 'SELECT_MULTI'
      ? (this._multiValues[field.fieldId] || []).join(',')
      : this._values[field.fieldId] || '';

    if (field.isMandatory && !value.trim()) return `${label} is required`;

    if (value.trim()) {
      if (field.dataType === 'TEXT' && field.validationRegex) {
        try {
          if (!new RegExp(field.validationRegex).test(value)) {
            return field.validationMessage || `Invalid value for ${label}`;
          }
        } catch (e) { /* skip */ }
      }
      if (field.dataType === 'NUMBER') {
        const num = Number(value);
        if (isNaN(num)) return 'Must be a number';
        if (field.minValue !== null && num < field.minValue) return `Minimum value is ${field.minValue}`;
        if (field.maxValue !== null && num > field.maxValue) return `Maximum value is ${field.maxValue}`;
      }
    }
    return '';
  },

  _updateRadioStyles(fieldId) {
    const field = this._fields.find(f => f.fieldId === fieldId);
    if (!field) return;
    const selectedVal = this._values[fieldId];
    field.options.forEach(opt => {
      const $lbl = $(`label[data-for="radio-${fieldId}-${opt.optionId}"]`);
      if (selectedVal === opt.optionValue) {
        $lbl.css({ borderColor: '#667eea', background: '#eef2ff' });
      } else {
        $lbl.css({ borderColor: '#e2e8f0', background: 'white' });
      }
    });
  },

  _renderField(field) {
    const label = this._getLabel(field);
    const mandatory = field.isMandatory ? '<span style="color:#e53e3e">*</span>' : '';
    const style = `border-radius:10px;padding:.75rem;border:2px solid #e2e8f0;
      font-size:.95rem;background-color:#fff;color:#2d3748;`;

    let inputHtml = '';
    if (field.dataType === 'TEXT') {
      inputHtml = `<input type="text" class="form-control field-input" data-field="${field.fieldId}"
        placeholder="${escapeHtml(field.placeholder || '')}" style="${style}">`;
    } else if (field.dataType === 'NUMBER') {
      const min = field.minValue !== null ? `min="${field.minValue}"` : '';
      const max = field.maxValue !== null ? `max="${field.maxValue}"` : '';
      inputHtml = `<input type="number" class="form-control field-input" data-field="${field.fieldId}"
        placeholder="${escapeHtml(field.placeholder || '')}" ${min} ${max} style="${style}">`;
    } else if (field.dataType === 'DATE') {
      inputHtml = `<input type="date" class="form-control field-input" data-field="${field.fieldId}" style="${style}">`;
    } else if (field.dataType === 'SELECT_SINGLE') {
      if (field.options.length <= 4) {
        // Radio buttons styled as labels
        const radios = field.options.map(opt => `
          <label data-for="radio-${field.fieldId}-${opt.optionId}"
            style="padding:.75rem 1rem;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;
            display:flex;align-items:center;flex:${field.options.length <= 2 ? 1 : 'unset'};transition:all .2s ease;">
            <input type="radio" class="field-radio" name="radio-${field.fieldId}"
              value="${escapeHtml(opt.optionValue)}" data-field="${field.fieldId}"
              style="width:20px;height:20px;margin-right:.75rem;cursor:pointer;accent-color:#667eea;">
            <span style="font-size:.95rem;color:#2d3748;">${escapeHtml(opt.optionLabel)}</span>
          </label>`).join('');
        inputHtml = `<div class="d-flex gap-3 flex-wrap">${radios}</div>`;
      } else {
        const options = field.options.map(o =>
          `<option value="${escapeHtml(o.optionValue)}">${escapeHtml(o.optionLabel)}</option>`).join('');
        inputHtml = `<select class="form-select field-input" data-field="${field.fieldId}" style="${style}">
          <option value="">Select an option</option>${options}</select>`;
      }
    } else if (field.dataType === 'SELECT_MULTI') {
      const checkboxes = field.options.map(opt => `
        <label data-for="multi-${field.fieldId}-${opt.optionValue}"
          style="padding:.5rem 1rem;border:2px solid #e2e8f0;border-radius:10px;cursor:pointer;
          display:flex;align-items:center;transition:all .2s ease;">
          <input type="checkbox" class="field-checkbox" name="multi-${field.fieldId}"
            value="${escapeHtml(opt.optionValue)}" data-field="${field.fieldId}"
            style="width:18px;height:18px;margin-right:.5rem;cursor:pointer;accent-color:#667eea;">
          <span style="font-size:.95rem;color:#2d3748;">${escapeHtml(opt.optionLabel)}</span>
        </label>`).join('');
      inputHtml = `<div class="d-flex flex-wrap gap-2">${checkboxes}</div>`;
    }

    return `
      <div class="mb-3">
        <label class="form-label" style="font-weight:500;color:#4a5568;">${label} ${mandatory}</label>
        ${inputHtml}
        <div class="field-error" id="field-err-${field.fieldId}" style="display:none;"></div>
      </div>`;
  }
};
