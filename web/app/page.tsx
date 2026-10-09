"use client";

import { type SubmitEvent, useEffect, useState } from "react";

type Membership = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
};

type Me = {
  id: string;
  email: string;
  display_name: string;
  memberships: Membership[];
};

type Mode = "sign-in" | "sign-up";

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) setMe((await response.json()) as Me);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setError("The sign-in service is unavailable.");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "sign-up" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const path = mode === "sign-in" ? "/api/sessions" : "/api/users";
    const payload =
      mode === "sign-in"
        ? { email, password }
        : { display_name: displayName, email, password };
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as Me & { detail?: string };
      if (!response.ok) {
        const fallback = mode === "sign-in" ? "Sign-in failed." : "Sign-up failed.";
        setError(typeof body.detail === "string" ? body.detail : fallback);
        return;
      }
      setMe(body);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("The sign-in service is unavailable.");
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok || response.status === 204) {
        setMe(null);
        setMode("sign-in");
        setPassword("");
        setConfirmPassword("");
        return;
      }
      setError("Sign-out failed.");
    } catch {
      setError("The sign-in service is unavailable.");
    } finally {
      setPending(false);
    }
  }

  if (ready && me) {
    return (
      <main className="home">
        <header className="top">
          <p className="mark">Learning Lab</p>
          <button
            type="button"
            className="quiet"
            onClick={signOut}
            disabled={pending}
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </header>
        <h1>Home</h1>
        <p className="lede">Welcome, {me.display_name}.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <section className="placeholder">
          <h2>Classes</h2>
          <p>Your classes will show up here.</p>
        </section>
      </main>
    );
  }

  const signingUp = mode === "sign-up";

  return (
    <main className="shell">
      <section className="panel">
        <p className="mark">Learning Lab</p>
        <h1>{signingUp ? "Create an account" : "Sign in"}</h1>
        <p className="lede">
          {signingUp
            ? "Use your name, email, and a password."
            : "Use the account your school gave you, or create one."}
        </p>
        {!ready ? <p className="status">Checking your session…</p> : null}
        {ready ? (
          <form onSubmit={onSubmit}>
            {signingUp ? (
              <label>
                Name
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={signingUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={signingUp ? 8 : undefined}
              />
            </label>
            {signingUp ? (
              <label>
                Confirm password
                <input
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </label>
            ) : null}
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={pending}>
              {pending
                ? signingUp
                  ? "Creating account…"
                  : "Signing in…"
                : signingUp
                  ? "Create account"
                  : "Sign in"}
            </button>
            <p className="switch">
              {signingUp ? "Already have an account? " : "New here? "}
              <button
                type="button"
                className="text-button"
                onClick={() => switchMode(signingUp ? "sign-in" : "sign-up")}
                disabled={pending}
              >
                {signingUp ? "Sign in" : "Create an account"}
              </button>
            </p>
          </form>
        ) : null}
      </section>
    </main>
  );
}
