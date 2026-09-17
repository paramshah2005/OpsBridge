export default function Login() {
  return (
    <main className="login-shell">
      <div className="noise" />
      <nav className="topbar"><a className="brand" href="/"><span className="brand-mark">✦</span> OpsBridge</a><span className="topbar-note">GitHub-native control plane</span></nav>
      <section className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pulse" /> REPO ACCESS</p>
          <h1>Your GitHub,<br /><em>in one clear view.</em></h1>
          <p className="lede">A calm, focused starting point for the repositories you ship. Connect your GitHub account and see your working landscape at a glance.</p>
          <a className="github-button" href="/api/auth/github"><span className="github-icon">●</span> Sign in with GitHub <span className="arrow">↗</span></a>
          <p className="security-note"><span>⌁</span> Repository access · You can revoke access anytime</p>
        </div>
        <div className="hero-art" aria-label="OpsBridge workspace preview">
          <div className="art-glow" />
          <div className="preview-window">
            <div className="preview-head"><span className="mini-dots">● ● ●</span><span className="preview-url">opsbridge / repos</span><span>···</span></div>
            <div className="preview-body"><div className="preview-sidebar"><div className="fake-logo">✦</div><span className="side-line active" /><span className="side-line" /><span className="side-line" /><span className="side-line short" /></div><div className="preview-content"><div className="preview-kicker">YOUR WORKSPACE</div><div className="preview-title">Good to have you back.</div><div className="fake-search">⌕ &nbsp; Filter repositories</div><div className="repo-cards"><div><b>◈  storefront-api</b><small>main · updated 2h ago</small></div><div><b>◈  design-system</b><small>main · updated yesterday</small></div><div><b>◈  opsbridge</b><small>main · updated 3d ago</small></div></div></div></div>
          </div>
        </div>
      </section>
      <footer className="login-footer"><span>Built for teams who ship with intention.</span></footer>
    </main>
  );
}
