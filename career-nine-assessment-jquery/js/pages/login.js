// Career-9 Assessment - Student Login Page
const Pages = window.Pages || {};

Pages.login = {
  render() {
    allowReload();
    // Clear all storage on login page
    localStorage.clear();
    sessionStorage.clear();
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    AppState.clearAssessment();

    $('#app-root').html(`
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;width:100vw;
        margin:0;padding:2rem 1rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        position:fixed;top:0;left:0;overflow:auto;color-scheme:light;">
        <div class="card shadow-lg" style="width:550px;max-width:95%;border-radius:20px;border:none;background:#ffffff;">
          <div class="card-body p-5" style="border-radius:20px;background:#ffffff;color:#2d3748;">

            <!-- Logo -->
            <div style="width:220px;height:80px;background:white;border-radius:10%;display:flex;
              align-items:center;justify-content:center;margin:0 auto 1.5rem;">
              <img src="/media/logos/kcc.jpg" alt="Logo"
                style="width:100%;height:100%;object-fit:contain;border-radius:10%;padding:8px;">
            </div>

            <h2 class="text-center mb-2" style="font-size:2.25rem;font-weight:700;color:#2d3748;">Assessment Login</h2>
            <p class="text-center mb-5" style="color:#718096;font-size:1rem;">Sign in to continue to your assessment</p>

            <form id="login-form" novalidate>
              <!-- Username -->
              <div class="mb-4">
                <label class="form-label" style="font-size:.95rem;font-weight:600;color:#4a5568;">Username</label>
                <div style="position:relative;">
                  <div style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#a0aec0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <input type="text" id="userId" class="form-control" placeholder="Enter your User ID"
                    style="padding:.875rem 1rem .875rem 3rem;font-size:1rem;border-radius:10px;border:2px solid #e2e8f0;
                    background:#fff;color:#2d3748;">
                  <div class="field-error" id="userId-error" style="display:none;color:#e53e3e;font-size:.875rem;margin-top:.5rem;"></div>
                </div>
              </div>

              <!-- DOB -->
              <div class="mb-5">
                <label class="form-label" style="font-size:.95rem;font-weight:600;color:#4a5568;">Date of Birth</label>
                <div style="position:relative;">
                  <div style="position:absolute;left:1rem;top:50%;transform:translateY(-50%);color:#a0aec0;z-index:1;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div class="input-group">
                    <input type="text" id="dob" class="form-control" placeholder="dd-mm-yyyy" maxlength="10"
                      style="padding:.875rem 1rem .875rem 3rem;font-size:1rem;border-radius:10px 0 0 10px;
                      border:2px solid #e2e8f0;border-right:none;background:#fff;color:#2d3748;">
                    <button type="button" id="cal-btn"
                      style="border:2px solid #e2e8f0;border-left:none;background:white;
                      border-radius:0 10px 10px 0;padding:0 1rem;cursor:pointer;font-size:1.25rem;">&#x1F4C5;</button>
                    <input type="date" id="date-picker" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;">
                  </div>
                  <div class="field-error" id="dob-error" style="display:none;color:#e53e3e;font-size:.875rem;margin-top:.5rem;"></div>
                </div>
              </div>

              <button type="submit" id="login-btn" class="btn w-100"
                style="padding:.875rem;font-size:1.1rem;font-weight:600;
                background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;
                border-radius:10px;box-shadow:0 4px 15px rgba(102,126,234,.4);transition:all .3s ease;margin-top:1rem;">
                Sign In
              </button>
              <div class="text-center mt-4" style="color:#718096;font-size:.9rem;">Need help? Contact your administrator</div>
            </form>
          </div>
        </div>
      </div>
    `);

    // ── Event handlers ──────────────────────────────────────────────────────

    // DOB text input auto-format
    $('#dob').on('input', function() {
      const formatted = formatDob($(this).val());
      $(this).val(formatted);
    });

    // Calendar button
    $('#cal-btn').on('click', function() {
      const picker = document.getElementById('date-picker');
      if (picker.showPicker) picker.showPicker();
      else picker.click();
    });

    // Calendar date selection
    $('#date-picker').on('change', function() {
      const v = $(this).val();
      if (v) {
        const [year, month, day] = v.split('-');
        $('#dob').val(`${day}-${month}-${year}`);
      }
    });

    // Submit
    $('#login-form').on('submit', async function(e) {
      e.preventDefault();

      const userId = $('#userId').val().trim();
      const dob = $('#dob').val().trim();

      let valid = true;

      // Validate userId
      if (!userId) {
        $('#userId-error').text('User ID is required').show();
        $('#userId').addClass('is-invalid');
        valid = false;
      } else {
        $('#userId-error').hide();
        $('#userId').removeClass('is-invalid');
      }

      // Validate dob
      const dobErr = validateDob(dob);
      if (dobErr) {
        $('#dob-error').text(dobErr).show();
        $('#dob').addClass('is-invalid');
        valid = false;
      } else {
        $('#dob-error').hide();
        $('#dob').removeClass('is-invalid');
      }

      if (!valid) return;

      const $btn = $('#login-btn');
      $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Signing In...');

      try {
        const { data } = await API.login(dob, userId);
        localStorage.setItem('userStudentId', data.userStudentId);
        localStorage.setItem('allottedAssessments', JSON.stringify(data.assessments));
        Router.navigate('allotted-assessment');
      } catch (error) {
        $btn.prop('disabled', false).text('Sign In');
        if (error.response) {
          alert('Invalid credentials. Please try again.');
        } else {
          alert('An error occurred. Please try again later.');
        }
      }
    });
  }
};

window.Pages = Pages;
