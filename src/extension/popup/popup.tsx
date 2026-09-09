import { createRoot } from 'react-dom/client';
import { createAdapter } from '../../browser/adapter/factory';

/**
 * Popup entry (milestone 0: foundation placeholder only).
 *
 * Compiled to popup.js at the extension root; popup.html + style.css are
 * static files copied verbatim by scripts/build-manifests.mjs. Vite HTML
 * entries emit absolute-rooted asset paths, which extension pages cannot
 * resolve — hence the static pair.
 */
const adapter = createAdapter();

function Popup() {
  return (
    <main className="shell">
      <header className="bar">
        <span className="brand">WEBGUARD</span>
        <span className="tick">FOUNDATION</span>
      </header>

      <section className="placeholder" aria-label="Security pulse placeholder">
        <p className="placeholder-title">SECURITY PULSE</p>
        <p className="placeholder-copy">
          Threat-surface analysis lands in the next milestone. The adapter,
          engine and scoring contracts are already wired.
        </p>
        <p className="placeholder-copy dim">
          Browsing data stays on this device. No network calls are made.
        </p>
      </section>

      <footer className="bar">
        <span>{adapter.id}</span>
        <span>{adapter.capabilities.backgroundModel}</span>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}