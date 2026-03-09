// Career-9 Assessment - Utility Functions

// Format seconds as HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Check if a text is "NA" / "N/A"
function isNA(text) {
  if (!text) return false;
  const t = text.trim().toUpperCase();
  return t === 'NA' || t === 'N/A';
}

// Device detection
function isMobileOrTablet() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipod|android|blackberry|windows phone|webos/.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet|kindle|silk/.test(ua);
  const isSmallScreen = window.innerWidth <= 1024;
  return isMobile || isTablet || isSmallScreen;
}

// Show global loading spinner
function showSpinner() {
  $('#global-spinner').show();
}

function hideSpinner() {
  $('#global-spinner').fadeOut(300);
}

// Clear all assessment localStorage keys
function clearAssessmentStorage() {
  const keys = [
    'assessmentAnswers', 'assessmentRankingAnswers', 'assessmentSavedForLater',
    'assessmentSkipped', 'assessmentElapsedTime', 'assessmentTextAnswers',
    'assessmentSeenSectionInstructions', 'assessmentCompletedGames',
    'assessmentId'
  ];
  keys.forEach(k => localStorage.removeItem(k));
}

// Truncate text
function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

// Prevent browser back/reload during assessment
function preventReload() {
  window.onbeforeunload = function() {
    return 'Are you sure you want to leave? Your progress may be lost.';
  };
}

function allowReload() {
  window.onbeforeunload = null;
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// DOB auto-format: dd-mm-yyyy
function formatDob(value) {
  value = value.replace(/[^\d-]/g, '');
  const digits = value.replace(/-/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
}

// Validate DOB
function validateDob(date) {
  if (!date) return 'Date of Birth is required';
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = date.match(regex);
  if (!match) return 'Please enter date in dd-mm-yyyy format';
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return 'Invalid month';
  if (day < 1 || day > 31) return 'Invalid day';
  return '';
}

// Show error message under a field
function showFieldError($field, message) {
  const $err = $field.siblings('.field-error');
  if ($err.length) {
    $err.text(message).show();
  } else {
    $('<div class="field-error"></div>').text(message).insertAfter($field);
  }
  $field.addClass('is-invalid');
}

function clearFieldError($field) {
  $field.siblings('.field-error').hide();
  $field.removeClass('is-invalid');
}
