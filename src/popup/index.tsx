import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getIsHidden, setIsHidden } from "../utils";

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);

  function Popup() {
    const [hidden, setHidden] = useState<boolean | null>(null);

    useEffect(() => {
      let mounted = true;

      (async () => {
        const value = await getIsHidden();
        if (mounted) setHidden(value);
      })();

      return () => {
        mounted = false;
      };
    }, []);

    const toggle = async () => {
      // If not yet initialized, ignore
      if (hidden === null) return;
      const newState = !hidden;
      setHidden(newState);
      await setIsHidden(newState);
    };

    const isLoading = hidden === null;
    const statusLabel = isLoading ? "Loading" : hidden ? "Hidden" : "Visible";
    const actionLabel = isLoading
      ? "Loading..."
      : hidden
        ? "Show information"
        : "Hide information";

    return (
      <div
        className="hsi-popup-container"
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
          padding: 16,
          width: 320,
          background: "linear-gradient(135deg,#1e293b,#0f172a)",
          color: "#f1f5f9",
        }}
      >
        <header
          style={{
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              fontSize: 14,
              margin: 0,
              fontWeight: 600,
              letterSpacing: 0.25,
            }}
          >
            Hide Sensitive Information
          </h1>
          <span
            aria-live="polite"
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: hidden
                ? "rgba(239,68,68,0.15)"
                : "rgba(16,185,129,0.15)",
              color: hidden ? "#f87171" : "#34d399",
              border: `1px solid ${hidden ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"}`,
              backdropFilter: "blur(4px)",
            }}
          >
            {statusLabel}
          </span>
        </header>

        <section
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 14,
            boxShadow: "0 2px 6px -2px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.85,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontWeight: 500 }}>Preview</span>
            <span
              style={{
                fontSize: 10,
                background: "rgba(148,163,184,0.15)",
                padding: "2px 6px",
                borderRadius: 6,
                letterSpacing: 0.5,
                color: "#cbd5e1",
              }}
            >
              sample
            </span>
          </div>
          <code
            data-testid="sensitive-value"
            style={{
              display: "block",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
              background: "rgba(0,0,0,0.35)",
              padding: "8px 10px",
              borderRadius: 8,
              lineHeight: 1.4,
              wordBreak: "break-all",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {isLoading
              ? "Loading…"
              : hidden
                ? "••••••••••"
                : "example.user@domain.com"}
          </code>
        </section>

        <button
          onClick={toggle}
          // accessibility
          aria-pressed={hidden ? true : false}
          disabled={isLoading}
          data-testid="toggle-button"
          style={{
            width: "100%",
            cursor: isLoading ? "not-allowed" : "pointer",
            background: hidden
              ? "linear-gradient(90deg,#10b981,#059669)"
              : "linear-gradient(90deg,#ef4444,#dc2626)",
            color: "#f8fafc",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 14px",
            borderRadius: 10,
            letterSpacing: 0.3,
            boxShadow: hidden
              ? "0 4px 12px -2px rgba(16,185,129,0.35)"
              : "0 4px 12px -2px rgba(239,68,68,0.35)",
            transition: "background .25s, transform .15s, box-shadow .25s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: isLoading ? 0.6 : 1,
          }}
          onMouseDown={(e) => {
            if (!isLoading)
              (e.currentTarget as HTMLButtonElement).style.transform =
                "scale(.97)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          }}
        >
          {actionLabel}
        </button>

        <footer
          style={{
            marginTop: 14,
            textAlign: "center",
            fontSize: 10,
            opacity: 0.55,
            lineHeight: 1.3,
          }}
        >
          <span>
            Toggle masking of detected email addresses on active tabs.
          </span>
        </footer>
      </div>
    );
  }

  root.render(<Popup />);
}
