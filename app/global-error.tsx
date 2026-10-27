"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f6f6f9",
          color: "#17171d",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "440px", textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              display: "grid",
              placeItems: "center",
              margin: "0 auto",
              borderRadius: "16px",
              background: "rgba(229,72,77,0.1)",
              color: "#e5484d",
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <h1 style={{ marginTop: "20px", fontSize: "22px", letterSpacing: "-0.02em" }}>
            Whisk Flow needs a reload
          </h1>
          <p style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.7, color: "#6e6e7c" }}>
            A critical error interrupted the app. Your saved projects and media are unaffected.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "12px", fontFamily: "ui-monospace, monospace", fontSize: "10px", color: "#6e6e7c" }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: "20px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "40px",
              padding: "0 18px",
              border: 0,
              borderRadius: "12px",
              background: "linear-gradient(120deg, #6c4cf1, #4f8cff)",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} /> Reload the studio
          </button>
        </div>
      </body>
    </html>
  );
}
