import { JetBrains_Mono } from "next/font/google";
import { FaGithub } from "react-icons/fa";
import { FiArrowUpRight } from "react-icons/fi";
import styles from "./Login.module.css";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const capabilities = [
  {
    number: "01",
    title: "Conversation",
    body: "A persistent live chatroom scoped to the repository your team is shipping.",
  },
  {
    number: "02",
    title: "GitHub activity",
    body: "Pull requests, commits, branches, and workflow events arrive in the same context.",
  },
  {
    number: "03",
    title: "Security gates",
    body: "Trivy, Semgrep, and SBOM results surface where engineering decisions happen.",
  },
  {
    number: "04",
    title: "Repository actions",
    body: "Run scans, check status, and raise pull requests without leaving the room.",
  },
];

const workflow = [
  ["01", "Connect", "Sign in with GitHub and load the repositories you can access."],
  ["02", "Choose", "Open a dedicated workspace for the repository you want to operate."],
  ["03", "Ship", "Coordinate chat, delivery activity, and security checks in one live room."],
];

export default function Login() {
  return (
    <div className={`${styles.shell} ${jetBrainsMono.className}`}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/" aria-label="OpsBridge home">
          OPSBRIDGE<span className={styles.wordmarkStop}>.</span>
        </a>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#workflow">Workflow</a>
          <a href="#security">Security</a>
        </nav>
        <a className={styles.headerCta} href="/api/auth/github">
          Sign in
          <FiArrowUpRight aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroIndex} aria-hidden="true">
            01
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>GitHub-native DevSecOps collaboration</p>
            <h1 id="hero-title">One room for every repository.</h1>
            <p className={styles.heroText}>
              OpsBridge brings team chat, GitHub activity, deployment status,
              and security gates into one live, repository-scoped workspace.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryCta} href="/api/auth/github">
                <FaGithub aria-hidden="true" />
                Sign in with GitHub
                <FiArrowUpRight aria-hidden="true" />
              </a>
              <span className={styles.authNote}>
                GitHub OAuth
                <br />
                Revoke access at any time
              </span>
            </div>
          </div>

          <aside className={styles.controlMap} aria-label="OpsBridge product flow">
            <div className={styles.mapHeader}>
              <span>CONTROL PLANE</span>
              <span>LIVE CONTEXT</span>
            </div>
            <div className={styles.mapStage}>
              <span className={styles.mapNumber}>01</span>
              <div>
                <strong>GitHub</strong>
                <span>Repositories + events</span>
              </div>
            </div>
            <div className={styles.mapConnector} aria-hidden="true">
              <span />
            </div>
            <div className={`${styles.mapStage} ${styles.mapStageActive}`}>
              <span className={styles.mapNumber}>02</span>
              <div>
                <strong>OpsBridge</strong>
                <span>Chat + security + delivery</span>
              </div>
            </div>
            <div className={styles.mapConnector} aria-hidden="true">
              <span />
            </div>
            <div className={styles.mapStage}>
              <span className={styles.mapNumber}>03</span>
              <div>
                <strong>Your team</strong>
                <span>Shared repository context</span>
              </div>
            </div>
            <div className={styles.mapFooter}>
              <span>NEON POSTGRESQL</span>
              <span>WEBSOCKET DELIVERY</span>
            </div>
          </aside>
        </section>

        <section className={styles.capabilities} id="capabilities" aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <p className={styles.sectionNumber}>02 / CAPABILITIES</p>
            <h2 id="capabilities-title">The repository is the workspace.</h2>
            <p>
              Decisions stay beside the code, events, and security results that
              informed them.
            </p>
          </div>
          <div className={styles.capabilityList}>
            {capabilities.map((capability) => (
              <article className={styles.capability} key={capability.number}>
                <span>{capability.number}</span>
                <h3>{capability.title}</h3>
                <p>{capability.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.commandSection} id="security" aria-labelledby="command-title">
          <div className={styles.commandIntro}>
            <p className={styles.inverseNumber}>03 / OPERATE</p>
            <h2 id="command-title">From conversation to action.</h2>
            <p>
              OpsBridge commands use the same repository context as the room,
              so operational work remains visible to the whole team.
            </p>
          </div>
          <div className={styles.commandList} aria-label="Supported repository commands">
            <div>
              <code>/status</code>
              <span>Read the current pull-request and security-gate state.</span>
            </div>
            <div>
              <code>/rerun-trivy-scan</code>
              <span>Trigger the repository&apos;s container vulnerability scan.</span>
            </div>
            <div>
              <code>/raise-pr</code>
              <span>Create a pull request through the GitHub API.</span>
            </div>
          </div>
        </section>

        <section className={styles.workflow} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.workflowTitle}>
            <p className={styles.sectionNumber}>04 / WORKFLOW</p>
            <h2 id="workflow-title">Connect. Choose. Ship.</h2>
          </div>
          <ol className={styles.workflowSteps}>
            {workflow.map(([number, title, body]) => (
              <li key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <p>READY WHEN YOUR REPOSITORY IS</p>
          <h2 id="final-cta-title">Bring your delivery work into one clear view.</h2>
          <a className={styles.finalCtaLink} href="/api/auth/github">
            <FaGithub aria-hidden="true" />
            Continue with GitHub
            <FiArrowUpRight aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className={styles.footer}>
        <a className={styles.wordmark} href="/" aria-label="OpsBridge home">
          OPSBRIDGE<span className={styles.wordmarkStop}>.</span>
        </a>
        <p>GitHub-native DevSecOps collaboration.</p>
        <p>Built for teams that ship together.</p>
      </footer>
    </div>
  );
}
