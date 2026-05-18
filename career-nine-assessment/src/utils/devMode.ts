export function isDevAutoFillEnabled(): boolean {
  const host = window.location.hostname;
  return (
    host === 'staging-assessment.career-9.com' ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}
