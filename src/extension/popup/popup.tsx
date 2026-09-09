import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SecurityReport } from '../../core/types/security-report';
import { requestAnalysis } from './client';
import { ErrorView, FindingList, LoadingView, ScoreCard, UnsupportedView } from './views';

/**
 * Popup entry (milestone 1: first working vertical slice).
 *
 * Renders the security report produced by the background: host, score,
 * status and an expandable findings list. All analysis happens in core/ — this
 * component only fetches (via client.ts) and renders. The "Security Pulse /
 * Threat Surface" experience is intentionally NOT built yet.
 *
 * Static popup.html + style.css ship alongside the compiled popup.js (see
 * scripts/build-manifests.mjs); Vite HTML entries cannot be used for
 * extension pages (absolute-rooted asset paths).
 */

type PopupState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'error'; readonly detail: string }
  | { readonly kind: 'report'; readonly report: SecurityReport };

function Popup() {
  const [state, setState] = useState<PopupState>({ kind: 'loading' });

  useEffect(() => {
    void runAnalysis();
  }, []);

  async function runAnalysis(): Promise<void> {
    setState({ kind: 'loading' });
    try {
      const response = await requestAnalysis();
      if (response.ok) {
        setState({ kind: 'report', report: response.report });
      } else if (response.reason === 'unsupported-page') {
        setState({ kind: 'unsupported' });
      } else {
        setState({ kind: 'error', detail: response.detail });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not reach the background service.';
      setState({ kind: 'error', detail });
    }
  }

  return (
    <main className="shell">
      <header className="bar">
        <span className="brand">WEBGUARD</span>
        <span className="tick">SECURITY REPORT</span>
      </header>

      {renderState(state, runAnalysis)}

      <footer className="bar">
        <span>LOCAL ANALYSIS</span>
        <span>NO DATA LEAVES DEVICE</span>
      </footer>
    </main>
  );
}

function renderState(state: PopupState, onRetry: () => void) {
  switch (state.kind) {
    case 'loading':
      return <LoadingView />;
    case 'unsupported':
      return <UnsupportedView />;
    case 'error':
      return <ErrorView detail={state.detail} onRetry={onRetry} />;
    case 'report':
      return (
        <>
          <ScoreCard report={state.report} />
          <FindingList findings={state.report.findings} />
        </>
      );
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}