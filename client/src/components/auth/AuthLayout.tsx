import type { PropsWithChildren } from "react";

export function AuthLayout({ children, wide = false }: PropsWithChildren<{ wide?: boolean }>) {
  return (
    <div className={`minimal-site auth-shell ${wide ? "auth-shell-wide" : ""}`}>
      <a className="ms-skip" href="#main-content">Skip to content</a>
      <header className="auth-header">
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
      </header>
      <div className="auth-body">
        <main id="main-content" className="auth-content">{children}</main>
        <aside className="auth-art" aria-label="Illustrative robotics scene">
          <img src="/images/site-led/auth/packing.webp" width="1024" height="1536" alt="Illustration of a humanoid packing a carton at a warehouse bench" loading="lazy" />
          <span>Illustrative scene</span>
        </aside>
      </div>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} Blueprint Robotics, Inc.</span><nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>
    </div>
  );
}

export function AuthSteps({ currentStep, labels }: { currentStep: number; labels: readonly string[] }) {
  return <ol className="auth-progress" aria-label="Account setup progress">{labels.map((label, index) => <li key={label} aria-current={index + 1 === currentStep ? "step" : undefined} data-complete={index + 1 < currentStep}><span>{index + 1}</span>{label}</li>)}</ol>;
}
