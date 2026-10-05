"use client";

import { FormEvent, useState } from "react";

type CheckResult = {
  platformId: string;
  platformName: string;
  kind: string;
  status: string;
  profileUrl?: string;
};

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(
        `/api/check?username=${encodeURIComponent(username.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ marginBottom: 8 }}>Handle Hub</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Check a username across gaming platforms and social networks.
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter a username"
          aria-label="Username"
          style={{ flex: 1, padding: "0.75rem 1rem", fontSize: 16 }}
        />
        <button type="submit" disabled={loading || !username.trim()}>
          {loading ? "Checking…" : "Check"}
        </button>
      </form>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
      {results && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 32 }}>
          {results.map((r) => (
            <li
              key={r.platformId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0.75rem 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <span>
                <strong>{r.platformName}</strong>{" "}
                <span style={{ color: "#777" }}>({r.kind})</span>
              </span>
              <span>{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
