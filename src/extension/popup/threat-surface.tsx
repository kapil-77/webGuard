import { useState } from 'react';
import type { SecurityReport } from '../../core/types/security-report';
import { RESOURCE_KINDS } from '../../core/types/resource-info';
import {
  MAX_DISPLAYED_FIRST_PARTY_NODES,
  MAX_DISPLAYED_THIRD_PARTY_NODES,
  buildThreatSurface,
  type ThreatNode,
  type ThreatRisk,
} from './threat-surface-model';

/**
 * Threat-surface visualization.
 *
 * Renders the report's real scan data as a mini network map: the page is the
 * central node, same-origin resources branch left (first-party) and every
 * observed external origin branches right (third-party). Nodes are clickable
 * and show domain, resource count, risk level and why each origin was
 * flagged. Everything is derived by `buildThreatSurface` from the report —
 * nothing here is hardcoded.
 *
 * The map is drawn with a percentage-coordinate SVG backdrop (no DOM
 * measurement loops) and CSS-only animations, so it stays lightweight and
 * responsive inside the 340px popup.
 */

const RISK_GLYPHS: Readonly<Record<ThreatRisk, string>> = { safe: '✓', warning: '⚠', risk: '🔴' };
const RISK_NAMES: Readonly<Record<ThreatRisk, string>> = { safe: 'SAFE', warning: 'WARNING', risk: 'RISK' };

/** Node anchors as percentages of the map box (shared with the SVG viewBox). */
const CENTER_X = 50;
const LEFT_X = 12;
const RIGHT_X = 88;
const CENTER_Y = 18;
const EDGE_START_Y = 26;
/** Horizontal inset where an edge meets its node chip (viewBox units). */
const SIDE_EDGE_DX = 15;

const MAP_MIN_HEIGHT_PX = 150;
const ROW_HEIGHT_PX = 30;

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

/** Evenly spreads `count` anchors between y=20 and y=82 in viewBox units. */
function anchorYs(count: number): number[] {
  if (count <= 1) return [50];
  const ys: number[] = [];
  for (let i = 0; i < count; i += 1) ys.push(20 + (i * 62) / (count - 1));
  return ys;
}

export function ThreatSurfaceView({ report }: { report: SecurityReport }) {
  const surface = buildThreatSurface(report);
  const [selectedId, setSelectedId] = useState<string>('central');
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = Math.max(surface.firstParty.length, surface.thirdParty.length);
  const mapHeight = Math.max(MAP_MIN_HEIGHT_PX, 24 + rows * ROW_HEIGHT_PX);
  const firstYs = anchorYs(surface.firstParty.length);
  const thirdYs = anchorYs(surface.thirdParty.length);

  const hiddenParts: string[] = [];
  if (surface.hiddenThirdPartyCount > 0) {
    hiddenParts.push(`${surface.hiddenThirdPartyCount} third-party origin${plural(surface.hiddenThirdPartyCount)}`);
  }
  if (surface.hiddenFirstPartyCount > 0) {
    hiddenParts.push(`${surface.hiddenFirstPartyCount} first-party host${plural(surface.hiddenFirstPartyCount)}`);
  }

  const selectedNode =
    surface.firstParty.find((node) => node.id === selectedId) ??
    surface.thirdParty.find((node) => node.id === selectedId);

  return (
    <details className="threat" open>
      <summary className="threat-header">
        <span className="threat-title">THREAT SURFACE</span>
        <span className="threat-legend" aria-hidden="true">
          <span className="threat-legend-item" data-risk="safe">✓ SAFE</span>
          <span className="threat-legend-item" data-risk="warning">⚠ WARN</span>
          <span className="threat-legend-item" data-risk="risk">🔴 RISK</span>
        </span>
      </summary>

      <div
        className="threat-map"
        style={{ height: `${mapHeight}px` }}
        role="group"
        aria-label={`Threat surface of ${surface.central.hostname}`}
      >
        <svg className="threat-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {surface.firstParty.map((node, i) => (
            <line
              key={`edge:${node.id}`}
              className={`threat-edge${activeId === node.id || selectedId === node.id ? ' is-active' : ''}`}
              data-risk={node.risk}
              x1={CENTER_X}
              y1={EDGE_START_Y}
              x2={LEFT_X + SIDE_EDGE_DX}
              y2={firstYs[i] ?? 50}
            />
          ))}
          {surface.thirdParty.map((node, i) => (
            <line
              key={`edge:${node.id}`}
              className={`threat-edge${activeId === node.id || selectedId === node.id ? ' is-active' : ''}`}
              data-risk={node.risk}
              x1={CENTER_X}
              y1={EDGE_START_Y}
              x2={RIGHT_X - SIDE_EDGE_DX}
              y2={thirdYs[i] ?? 50}
            />
          ))}
        </svg>

        <button
          type="button"
          className="threat-node threat-central"
          style={{ left: `${CENTER_X}%`, top: `${CENTER_Y}%` }}
          data-risk={surface.central.risk}
          title={`${surface.central.hostname} — page under analysis — ${RISK_NAMES[surface.central.risk]}`}
          aria-current={selectedId === 'central' ? 'true' : undefined}
          aria-label={`${surface.central.hostname} — current website — ${RISK_NAMES[surface.central.risk]}`}
          onClick={() => setSelectedId('central')}
          onMouseEnter={() => setActiveId('central')}
          onMouseLeave={() => setActiveId(null)}
        >
          <span className="threat-node-glyph" aria-hidden="true">{RISK_GLYPHS[surface.central.risk]}</span>
          <span className="threat-node-label">{surface.central.label}</span>
          <span className="threat-node-count">{surface.central.resourceCount}</span>
        </button>

        {surface.firstParty.map((node, i) => (
          <NodeChip
            key={node.id}
            node={node}
            x={LEFT_X}
            y={firstYs[i] ?? 50}
            index={i}
            selected={selectedId === node.id}
            onSelect={setSelectedId}
            onHover={setActiveId}
          />
        ))}
        {surface.thirdParty.map((node, i) => (
          <NodeChip
            key={node.id}
            node={node}
            x={RIGHT_X}
            y={thirdYs[i] ?? 50}
            index={i}
            selected={selectedId === node.id}
            onSelect={setSelectedId}
            onHover={setActiveId}
          />
        ))}
      </div>

      {hiddenParts.length > 0 ? (
        <p className="threat-more">
          + {hiddenParts.join(' · ')} beyond the first {MAX_DISPLAYED_FIRST_PARTY_NODES} first-party and{' '}
          {MAX_DISPLAYED_THIRD_PARTY_NODES} third-party nodes
        </p>
      ) : null}

      <section className="threat-detail" key={selectedId} role="region" aria-label="Selected domain details">
        {selectedId === 'central' ? renderCentralDetail(surface) : selectedNode ? renderNodeDetail(selectedNode) : null}
      </section>
    </details>
  );
}

interface NodeChipProps {
  readonly node: ThreatNode;
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
  readonly onHover: (id: string | null) => void;
}

function NodeChip({ node, x, y, index, selected, onSelect, onHover }: NodeChipProps) {
  return (
    <button
      type="button"
      className={`threat-node${selected ? ' is-selected' : ''}`}
      style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${60 + index * 40}ms` }}
      data-risk={node.risk}
      title={`${node.origin} — ${node.resourceCount} resource${plural(node.resourceCount)} — ${RISK_NAMES[node.risk]}`}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${node.origin} — ${node.resourceCount} resource${plural(node.resourceCount)} — ${RISK_NAMES[node.risk]}`}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="threat-node-glyph" aria-hidden="true">{RISK_GLYPHS[node.risk]}</span>
      <span className="threat-node-label">{node.label}</span>
      <span className="threat-node-count">{node.resourceCount}</span>
    </button>
  );
}

function renderCentralDetail(surface: ReturnType<typeof buildThreatSurface>) {
  const central = surface.central;
  return (
    <>
      <div className="threat-detail-row">
        <span className="threat-detail-name" title={central.hostname}>{central.label}</span>
        <span className="threat-detail-status" data-risk={central.risk}>
          {RISK_GLYPHS[central.risk]} {RISK_NAMES[central.risk]}
        </span>
      </div>
      <p className="threat-detail-meta">
        {central.resourceCount} resource{plural(central.resourceCount)} observed · {surface.totalOrigins} origin
        {plural(surface.totalOrigins)} in play
      </p>
      <p className="threat-detail-label">Report</p>
      <ul className="threat-detail-reasons">
        {central.reasons.map((reason) => (
          <li key={reason} className="threat-detail-reason">{reason}</li>
        ))}
      </ul>
    </>
  );
}

function renderNodeDetail(node: ThreatNode) {
  const kinds = RESOURCE_KINDS.filter((kind) => node.kindCounts[kind] > 0)
    .map((kind) => `${kind} ${node.kindCounts[kind]}`)
    .join(' · ');
  return (
    <>
      <div className="threat-detail-row">
        <span className="threat-detail-name" title={node.origin}>{node.origin}</span>
        <span className="threat-detail-status" data-risk={node.risk}>
          {RISK_GLYPHS[node.risk]} {RISK_NAMES[node.risk]}
        </span>
      </div>
      <p className="threat-detail-meta">
        {node.resourceCount} resource{plural(node.resourceCount)} · {kinds}
      </p>
      <p className="threat-detail-label">{node.risk === 'safe' ? 'Why it\u2019s safe' : 'Why it was flagged'}</p>
      <ul className="threat-detail-reasons">
        {node.reasons.map((reason) => (
          <li key={reason} className="threat-detail-reason">{reason}</li>
        ))}
      </ul>
      {node.findingTitles.length > 0 ? (
        <p className="threat-detail-findings">Reflected in findings: {node.findingTitles.join(' · ')}</p>
      ) : null}
    </>
  );
}