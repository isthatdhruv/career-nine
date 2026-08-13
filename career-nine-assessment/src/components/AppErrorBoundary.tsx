import React from 'react'
import { isChunkLoadError } from '../utils/lazyWithRetry'
import { suppressPreventReload } from '../hooks/usePreventReload'

/**
 * Top-level error boundary, wrapping the router.
 *
 * Before this existed, ANY uncaught render throw unmounted the React root and
 * left the student on a blank page with no message and no way forward — the
 * only escape was a manual browser reload. That covered a rejected lazy()
 * import (the /studentAssessment bug) but also ordinary render crashes, e.g.
 * an out-of-range questionIndex in the URL dereferencing `questions[i]`.
 *
 * Recovery is always USER-initiated. This boundary never reloads on its own:
 * it can be reached mid-assessment, where answers live only in React state
 * between Redis snapshots, so silently reloading could discard the student's
 * current section. The copy tells them their progress is safe on the server
 * (the /save-partial snapshot) before they choose to refresh.
 */

type Props = { children: React.ReactNode }
type State = { error: Error | null }

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    // Silence the beforeunload guard (usePreventReload is active on every
    // assessment page) so the student isn't asked to confirm a refresh they
    // just explicitly asked for.
    suppressPreventReload()
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const stale = isChunkLoadError(error)

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'linear-gradient(135deg, #0f172a 0%, #1a2238 50%, #1e293b 100%)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: '#fff',
            borderRadius: 20,
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>

          <h3 style={{ color: '#1f2937', fontWeight: 700, fontSize: '1.35rem', marginBottom: '0.6rem' }}>
            {stale ? 'The assessment was updated' : "Something didn't load"}
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {stale
              ? 'A newer version of the assessment is available. Refresh to continue — the answers you have submitted so far are saved on our servers.'
              : 'This page could not be opened. Refresh to try again — the answers you have submitted so far are saved on our servers.'}
          </p>

          <button
            onClick={this.handleReload}
            className="btn"
            style={{
              padding: '0.75rem 1.75rem',
              borderRadius: 12,
              border: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #5DD68D 0%, #3FB876 100%)',
              boxShadow: '0 4px 15px rgba(93,214,141,0.4)',
            }}
          >
            Refresh and continue
          </button>

          <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '1rem', marginBottom: 0 }}>
            If this keeps happening, tell your invigilator.
          </p>
        </div>
      </div>
    )
  }
}
