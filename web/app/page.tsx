"use client";

import { type SubmitEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        const fallback =
          mode === "sign-in" ? "Sign-in failed." : "Sign-up failed.";
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
      <main className="mx-auto min-h-svh max-w-3xl px-5 pt-7 pb-16">
        <header className="mb-12 flex items-center justify-between gap-4 font-sans">
          <p className="text-[13px] tracking-[0.08em] text-muted-foreground uppercase">
            Learning Lab
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={signOut}
            disabled={pending}
          >
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </header>
        <h1 className="text-[32px] leading-[1.15] font-semibold">Home</h1>
        <p className="mt-2 mb-6 text-muted-foreground">
          Welcome, {me.display_name}.
        </p>
        {error ? (
          <p className="mb-4 font-sans text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Your classes will show up here.</CardDescription>
          </CardContent>
        </Card>
      </main>
    );
  }

  const signingUp = mode === "sign-up";

  return (
    <main className="grid min-h-svh place-items-center px-4 py-8">
      <section className="w-full max-w-[420px]">
        <p className="mb-2 font-sans text-[13px] tracking-[0.08em] text-muted-foreground uppercase">
          Learning Lab
        </p>
        <h1 className="text-[32px] leading-[1.15] font-semibold">
          {signingUp ? "Create an account" : "Sign in"}
        </h1>
        <p className="mt-2 mb-6 text-muted-foreground">
          {signingUp
            ? "Use your name, email, and a password."
            : "Use the account your school gave you, or create one."}
        </p>
        {!ready ? (
          <p className="text-muted-foreground">Checking your session…</p>
        ) : null}
        {ready ? (
          <Card>
            <CardContent>
              <form className="grid gap-3.5 font-sans" onSubmit={onSubmit}>
                {signingUp ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                    />
                  </div>
                ) : null}
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    autoComplete={
                      signingUp ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={signingUp ? 8 : undefined}
                  />
                </div>
                {signingUp ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      name="confirm-password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                      minLength={8}
                    />
                  </div>
                ) : null}
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={pending}>
                  {pending
                    ? signingUp
                      ? "Creating account…"
                      : "Signing in…"
                    : signingUp
                      ? "Create account"
                      : "Sign in"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {signingUp ? "Already have an account? " : "New here? "}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 underline"
                    onClick={() =>
                      switchMode(signingUp ? "sign-in" : "sign-up")
                    }
                    disabled={pending}
                  >
                    {signingUp ? "Sign in" : "Create an account"}
                  </Button>
                </p>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
