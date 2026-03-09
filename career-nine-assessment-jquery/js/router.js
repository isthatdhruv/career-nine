// Career-9 Assessment - Hash-based SPA Router

const Router = {
  routes: [],

  // Register a route pattern and handler
  register(pattern, handler) {
    this.routes.push({ pattern, handler });
  },

  // Match current hash to a route
  match(hash) {
    // Remove leading #/
    const path = hash.replace(/^#\//, '').replace(/^#/, '');

    for (const route of this.routes) {
      const paramNames = [];
      // Convert :param to regex capture groups
      const regexStr = route.pattern
        .replace(/:[^/]+/g, (m) => {
          paramNames.push(m.slice(1));
          return '([^/]+)';
        })
        .replace(/\//g, '\\/');

      const regex = new RegExp(`^${regexStr}$`);
      const match = path.match(regex);

      if (match) {
        const params = {};
        paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  },

  // Navigate to a path (sets hash)
  navigate(path) {
    window.location.hash = '/' + path.replace(/^\//, '');
  },

  // Start the router
  start() {
    const dispatch = () => {
      const hash = window.location.hash || '#/student-login';
      const matched = this.match(hash);
      if (matched) {
        matched.handler(matched.params);
      } else {
        // Default to login
        this.navigate('student-login');
      }
    };

    $(window).on('hashchange', dispatch);
    dispatch(); // Run on initial load
  }
};

// ── Route Definitions ───────────────────────────────────────────────────────

Router.register('student-login',         () => Pages.login.render());
Router.register('demographics/:assessmentId', (p) => Pages.demographics.render(p.assessmentId));
Router.register('allotted-assessment',   () => Pages.allottedAssessment.render());
Router.register('general-instructions',  () => Pages.generalInstructions.render());
Router.register('studentAssessment',     () => Pages.selectSection.render());
Router.register('studentAssessment/sections/:sectionId', (p) => Pages.sectionInstruction.render(p.sectionId));
Router.register('studentAssessment/sections/:sectionId/questions/:questionIndex',
  (p) => Pages.sectionQuestion.render(p.sectionId, p.questionIndex));
Router.register('studentAssessment/completed', () => Pages.thankYou.render());
Router.register('assessment-register/:token',  (p) => Pages.register.render(p.token));

// ── Boot ─────────────────────────────────────────────────────────────────────
$(function () {
  hideSpinner();
  Router.start();
});
