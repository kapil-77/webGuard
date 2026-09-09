import type { Finding } from '../../core/types/finding';
import type { SecurityReport } from '../../core/types/security-report';
import type { Severity } from '../../core/types/severity';
import type { SecurityStatus } from '../../core/risk-scoring/security-status';
import { STATUS_DISPLAY_NAMES } from '../../core/risk-scoring/security-status';
import { riskContribution } from '../../core/risk-scoring/scorer';
import { displayUrl } from '../../lib/sanitize';

const GLYPHS: Readonly<Record<Severity, string>> = {
  critical: '✕',
  high: '⚠',
  medium: '⚠',
  low: '!',
  info: '✓',
};

export function StatusPill({ status }: { status: SecurityStatus }) {
  return (
    <span className="pill" data-status={status}>
      {STATUS_DISPLAY_NAMES[status]}
    </span>
  );
}

export function ScoreCard({ report }: { report: SecurityReport }) {
  const { page, score } = report;
  return (
    <section className="score" aria-label="Security score">
      <div className="score-host" title={page.url}>
        {displayUrl(page.url)}
      </div>
      <div className="score-value">
        <span className="score-num">{score.value}</span>
        <span className="score-den">/ 100</span>
      </div>
      <StatusPill status={score.status} />
    </section>
  );
}

export function FindingList({ findings }: { findings: readonly Finding[] }) {
  return (
    <section className="findings" aria-label="Security findings">
      <h2 className="findings-title">FINDINGS</h2>
      {findings.map((finding) => (
        <FindingItem key={finding.id} finding={finding} />
      ))}
    </section>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  const impact = riskContribution(finding);
  return (
    <details className={`finding finding-${finding.severity}`}>
      <summary>
        <span className="glyph" aria-hidden="true">
          {GLYPHS[finding.severity]}
        </span>
        <span className="finding-title">{finding.title}</span>
        <span className="finding-impact">{impact > 0 ? `−${impact} pts` : '0 pts'}</span>
      </summary>
      <div className="finding-detail">
        <p className="detail-label">What was detected</p>
        <p className="detail-text">{finding.description}</p>
        {finding.evidence ? (
          <>
            <p className="detail-label">Evidence</p>
            <code className="detail-code">{finding.evidence}</code>
          </>
        ) : null}
        <p className="detail-label">Score impact</p>
        <p className="detail-text">
          {impact === 0 ? 'No score impact.' : `Reduces the security score by ${impact} points.`}
        </p>
      </div>
    </details>
  );
}

export function LoadingView() {
  return (
    <section className="state" role="status">
      <div className="spinner" aria-hidden="true" />
      <p className="state-title">ANALYZING</p>
      <p className="state-copy">Inspecting the current page…</p>
    </section>
  );
}

export function UnsupportedView() {
  return (
    <section className="state" role="alert">
      <p className="state-title">CANNOT ANALYZE</p>
      <p className="state-copy">
        Browser-internal pages (settings, extension and chrome:// pages) cannot be analyzed. Open a regular web page and try again.
      </p>
    </section>
  );
}

export function ErrorView({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  return (
    <section className="state" role="alert">
      <p className="state-title">ANALYSIS FAILED</p>
      <p className="state-copy">{detail}</p>
      <button type="button" className="retry" onClick={onRetry}>
        RETRY
      </button>
    </section>
  );
}