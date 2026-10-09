"use client";

import { type FormEvent, useEffect, useState } from "react";

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

function roleLabel(role: string): string {
  if (role === "org_admin") return "Administrator";
  if (role === "member") return "Member";
  return role;
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as Me & { detail?: string };
      if (!response.ok) {
        setError(body.detail ?? "Sign-in failed.");
        return;
      }
      setMe(body);
      setPassword("");
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
        return;
      }
      setError("Sign-out failed.");
    } catch {
      setError("The sign-in service is unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <p className="mark">Learning Lab</p>
        <h1>{me ? "Signed in" : "Sign in"}</h1>
        <p className="lede">
          {me
            ? "Your school account is open in this browser."
            : "Use the account your school gave you."}
        </p>
        {!ready ? <p className="status">Checking your session…</p> : null}
        {ready && me ? (
          <div className="account">
            <p className="name">{me.display_name}</p>
            <p>{me.email}</p>
            {me.memberships.length === 0 ? (
              <p className="role">
                This account is not a member of a school yet.
              </p>
            ) : (
              me.memberships.map((membership) => (
                <p className="role" key={membership.organization_id}>
                  {membership.organization_name} · {roleLabel(membership.role)}
                </p>
              ))
            )}
            {error ? <p className="error">{error}</p> : null}
            <button type="button" onClick={signOut} disabled={pending}>
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : null}
        {ready && !me ? (
          <form onSubmit={onSubmit}>
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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
