// declare module '@yaireo/tagify';
// declare module '@yaireo/tagify/dist/react.tagify';

declare module 'react-toastify/dist/ReactToastify.css';

// CRA's bundled types (react-scripts/lib/react-app.d.ts) only declare '*.module.css',
// so every plain stylesheet side-effect import in the app reports TS2882 under
// TypeScript 5+ — which is what editors run, even though the repo pins 4.6.3.
// webpack resolves these at build time; the wildcards just keep the checker quiet.
// The more specific '*.module.css' declaration still wins for CSS modules.
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
