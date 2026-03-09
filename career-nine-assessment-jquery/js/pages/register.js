// Career-9 Assessment - Assessment Registration Page
Pages.register = {
  _mappingInfo: null,
  _result: null,

  async render(token) {
    allowReload();

    // Show loading
    $('#app-root').html(`
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:20px;">
        <div class="register-card">
          <div class="text-center py-5">
            <div class="spinner-border text-primary"></div>
            <p class="mt-3 text-muted">Loading assessment information...</p>
          </div>
        </div>
      </div>`);

    try {
      const res = await API.getRegistrationInfo(token);
      this._mappingInfo = res.data;
      this._renderForm(token);
    } catch (err) {
      this._renderError();
    }
  },

  _renderError() {
    $('#app-root').html(`
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:20px;">
        <div class="register-card">
          <div class="text-center py-5">
            <div style="font-size:4rem;color:#dc3545;">!</div>
            <h4 class="text-danger">Invalid or expired assessment link.</h4>
            <p class="text-muted mt-3">This link may have expired or been deactivated. Please contact your school administrator for a valid link.</p>
          </div>
        </div>
      </div>`);
  },

  _renderSuccess(result) {
    const isAlready = result.status === 'already_registered';
    $('#app-root').html(`
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:20px;">
        <div class="register-card">
          <div class="text-center py-4">
            <div style="font-size:3rem;color:${isAlready ? '#ffc107' : '#28a745'};">${isAlready ? '!' : '✓'}</div>
            <h4 class="${isAlready ? 'text-warning' : 'text-success'}">${escapeHtml(result.message || '')}</h4>
            ${result.username ? `
              <div class="mt-4 p-3 bg-light rounded d-inline-block text-start">
                <h6 class="mb-3">Your Login Credentials:</h6>
                <p class="mb-1"><strong>Username:</strong> <span class="badge bg-primary fs-6">${escapeHtml(result.username)}</span></p>
                <p class="mb-0"><strong>Date of Birth:</strong> <span class="badge bg-primary fs-6">${escapeHtml(result.dob || '')}</span></p>
              </div>
            ` : ''}
            <p class="text-muted mt-4" style="font-size:.9em;">Please save these credentials. You will need them to log in and take the assessment.</p>
            <button id="goto-login" class="btn btn-primary mt-3">Go to Student Login</button>
          </div>
        </div>
      </div>`);

    $('#goto-login').on('click', () => Router.navigate('student-login'));
  },

  _renderForm(token) {
    const info = this._mappingInfo;
    const subtitle = [
      info?.instituteName,
      info?.className ? `Class ${info.className}` : null,
      info?.sectionName ? `(${info.sectionName})` : null,
      info?.sessionYear
    ].filter(Boolean).join(' | ');

    const availableClasses = info?.availableClasses || [];
    const availableSections = info?.availableSections || [];

    let classHtml = '';
    if (info?.mappingLevel === 'SESSION' && availableClasses.length > 0) {
      const options = availableClasses.map(c =>
        `<option value="${c.id}">${escapeHtml(c.className)}</option>`).join('');
      classHtml = `
        <div class="col-md-6">
          <label class="form-label fw-bold">Class <span class="text-danger">*</span></label>
          <select id="reg-class" class="form-select">
            <option value="">Select Class</option>${options}
          </select>
        </div>
        <div class="col-md-6" id="section-col" style="display:none;">
          <label class="form-label fw-bold">Section</label>
          <select id="reg-section" class="form-select">
            <option value="">Select Section (Optional)</option>
          </select>
        </div>`;
    } else if (info?.mappingLevel === 'CLASS' && availableSections.length > 0) {
      const options = availableSections.map(s =>
        `<option value="${s.id}">${escapeHtml(s.sectionName)}</option>`).join('');
      classHtml = `
        <div class="col-md-6">
          <label class="form-label fw-bold">Section</label>
          <select id="reg-section" class="form-select">
            <option value="">Select Section (Optional)</option>${options}
          </select>
        </div>`;
    } else if (info?.mappingLevel === 'SECTION') {
      classHtml = `
        <div class="col-12">
          <div class="alert alert-info mb-0" style="font-size:.9em;">
            Class: <strong>${escapeHtml(info.className || '')}</strong> | Section: <strong>${escapeHtml(info.sectionName || '')}</strong>
          </div>
        </div>`;
    }

    $('#app-root').html(`
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:20px;">
        <div class="register-card">
          <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:24px;
            border-radius:12px 12px 0 0;color:white;">
            <h4 class="mb-1">${escapeHtml(info?.assessmentName || 'Assessment Registration')}</h4>
            <p class="mb-0" style="opacity:.9;font-size:.9em;">${escapeHtml(subtitle)}</p>
          </div>
          <form id="reg-form" style="padding:24px;">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label fw-bold">Full Name <span class="text-danger">*</span></label>
                <input type="text" id="reg-name" class="form-control" placeholder="Enter your full name" required>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Email <span class="text-danger">*</span></label>
                <input type="email" id="reg-email" class="form-control" placeholder="Enter your email" required>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Date of Birth <span class="text-danger">*</span></label>
                <input type="text" id="reg-dob" class="form-control" placeholder="dd-mm-yyyy" maxlength="10" required>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Phone Number</label>
                <input type="tel" id="reg-phone" class="form-control" placeholder="Enter phone number">
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">Gender</label>
                <select id="reg-gender" class="form-select">
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              ${classHtml}
            </div>
            <div class="mt-4">
              <button type="submit" id="reg-submit" class="btn btn-primary w-100" style="padding:10px;">Register</button>
            </div>
          </form>
        </div>
      </div>`);

    // DOB auto-format
    $('#reg-dob').on('input', function() {
      $(this).val(formatDob($(this).val()));
    });

    // Class → section cascading
    const self = this;
    $('#reg-class').on('change', function() {
      const classId = $(this).val();
      const cls = availableClasses.find(c => String(c.id) === String(classId));
      const sects = cls?.schoolSections || [];
      if (sects.length > 0) {
        const opts = sects.map(s => `<option value="${s.id}">${escapeHtml(s.sectionName)}</option>`).join('');
        $('#reg-section').html(`<option value="">Select Section (Optional)</option>${opts}`);
        $('#section-col').show();
      } else {
        $('#section-col').hide();
      }
    });

    $('#reg-form').on('submit', async function(e) {
      e.preventDefault();
      const name = $('#reg-name').val().trim();
      const email = $('#reg-email').val().trim();
      const dob = $('#reg-dob').val().trim();
      const phone = $('#reg-phone').val().trim();
      const gender = $('#reg-gender').val();

      if (!name || !email || !dob) {
        alert('Please fill in all required fields (Name, Email, Date of Birth).');
        return;
      }
      if (!/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
        alert('Date of Birth must be in dd-mm-yyyy format.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }

      const payload = { name, email, dob, phone, gender };
      const classId = $('#reg-class').val();
      const sectionId = $('#reg-section').val();
      if (classId) payload.classId = Number(classId);
      if (sectionId) payload.schoolSectionId = Number(sectionId);

      const $btn = $('#reg-submit');
      $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Registering...');

      try {
        const res = await API.registerStudent(token, payload);
        self._renderSuccess(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || err.response?.data || 'Registration failed. Please try again.';
        alert(typeof msg === 'string' ? msg : 'Registration failed.');
        $btn.prop('disabled', false).text('Register');
      }
    });
  }
};
