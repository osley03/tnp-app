import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, KeyRound, ScanEye } from "lucide-react";
import authBg from "@/assets/auth-bg.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Welcome to TNP — Your next chapter starts at home" },
      {
        name: "description",
        content:
          "Find your next rental, explore 360° room tours and connect with landlords through Tenant Network Profile.",
      },
      {
        property: "og:title",
        content: "Welcome to TNP — Tenant Network Profile",
      },
      {
        property: "og:description",
        content: "A clearer way to find a home and manage your rental journey.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="tnp-welcome">
      <img
        className="tnp-welcome-backdrop"
        src={authBg}
        width={1536}
        height={1024}
        alt="Modern homes at dusk, with warmly lit windows"
        fetchPriority="high"
      />
      <div className="tnp-welcome-shade" aria-hidden="true" />
      <div className="tnp-welcome-atmosphere" aria-hidden="true">
        <span />
        <span />
      </div>
      <header className="tnp-welcome-header">
        <Link to="/" className="tnp-welcome-brand" aria-label="TNP welcome">
          <span className="tnp-welcome-mark">
            <Building2 size={25} aria-hidden="true" />
          </span>
          <span>
            <strong>TNP</strong>
            <small>Tenant Network Profile</small>
          </span>
        </Link>
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="tnp-welcome-signin"
        >
          Sign in <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <div className="tnp-welcome-content">
        <section className="tnp-welcome-panel" aria-labelledby="welcome-title">
          <p className="tnp-welcome-eyebrow">
            <span /> WELCOME TO YOUR NEXT CHAPTER
          </p>
          <h1 id="welcome-title">
            A place to live.
            <br />
            <em>A space to belong.</em>
          </h1>
          <p className="tnp-welcome-description">
            Discover a home that feels right. Connect with landlords, step
            inside with 360° tours, and manage your rental journey in one place.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="tnp-welcome-continue"
          >
            Continue <ArrowRight size={21} aria-hidden="true" />
          </Link>
          <p className="tnp-welcome-note">
            Create your account as a tenant or landlord.
          </p>
          <div className="tnp-welcome-features">
            <span>
              <KeyRound size={19} aria-hidden="true" />
              Find your home
            </span>
            <span>
              <ScanEye size={19} aria-hidden="true" />
              Explore in 360°
            </span>
            <span>
              <Building2 size={19} aria-hidden="true" />
              List your property
            </span>
          </div>
        </section>
        <aside className="tnp-welcome-caption" aria-label="Welcome message">
          <span>MORE THAN AN ADDRESS</span>
          <p>
            The beginning of
            <br />
            something beautiful.
          </p>
          <small>Your next home is a new beginning.</small>
        </aside>
      </div>
      <footer className="tnp-welcome-footer">
        <span>MADE FOR YOUR RENTAL JOURNEY</span>
        <Link to="/report">Report suspicious activity</Link>
      </footer>
    </main>
  );
}
