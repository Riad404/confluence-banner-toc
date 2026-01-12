import React, { useEffect, useMemo, useState } from "react";
import { invoke, router } from "@forge/bridge";

const VERSION_LABEL = "2026-01-12-v7-cashed";

function chipStyleForLevel(level) {
  if (level === 1) {
    return {
      fontSize: 12.5,
      fontWeight: 700,
      color: "#172B4D",
      background: "#E9F2FF",
      borderColor: "#B3D4FF",
    };
  }

  return {
    fontSize: 12,
    fontWeight: 500,
    color: "#0052CC",
    background: "#F7F8F9",
    borderColor: "#DFE1E6",
  };
}

function loadCachedToc() {
  try {
    const last = sessionStorage.getItem("toc-banner-cache:last");
    if (!last) return null;
    return JSON.parse(last);
  } catch {
    return null;
  }
}

function saveCachedToc(toc) {
  try {
    sessionStorage.setItem("toc-banner-cache:last", JSON.stringify(toc));
  } catch {
    // ignore
  }
}

export default function App() {
  const [toc, setToc] = useState(() => loadCachedToc());
  const [error, setError] = useState(null);

  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftHidden, setDraftHidden] = useState(new Set());
  const [draftLabels, setDraftLabels] = useState({});

  async function refreshSilently() {
    setError(null);

    try {
      const data = await invoke("getToc", {});
      setToc(data);
      saveCachedToc(data);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    refreshSilently();
  }, []);

  const visibleItems = useMemo(() => {
    if (!toc?.items) return [];
    return toc.items.filter((it) => !it.hidden);
  }, [toc]);

  function startEdit() {
    if (!toc?.canEdit) return;

    const hidden = new Set(toc.items.filter((i) => i.hidden).map((i) => i.key));
    const labels = {};
    for (const it of toc.items) {
      if (it.label && it.label !== it.text) labels[it.key] = it.label;
    }
    setDraftHidden(hidden);
    setDraftLabels(labels);
    setEditing(true);
    setCollapsed(false);
  }

  async function saveEdit() {
    const res = await invoke("saveOverrides", {
      contentId: toc.contentId,
      hiddenKeys: Array.from(draftHidden),
      labelByKey: { ...draftLabels },
    });

    if (!res?.ok) {
      setError(res?.error || "Failed to save.");
      return;
    }

    setEditing(false);
    await refreshSilently();
  }

  async function jumpToAnchor(anchorId) {
    const hashOnly = `#${anchorId}`;

    try {
      await router.navigate(hashOnly);
      return;
    } catch {
      // continue
    }

    try {
      window.top.location.hash = hashOnly;
      return;
    } catch {
      // continue
    }

    if (toc?.pageUrl) {
      const full = `${toc.pageUrl}${hashOnly}`;
      try {
        await router.navigate(full);
      } catch {
        await router.open(full);
      }
    }
  }

  const hasData = Boolean(toc && toc.items);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "6px 10px",
        border: "1px solid #dfe1e6",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          style={{
            border: "1px solid #dfe1e6",
            background: "#fff",
            borderRadius: 6,
            padding: "1px 7px",
            cursor: "pointer",
            lineHeight: "16px",
          }}
          type="button"
          aria-label={collapsed ? "Expand contents" : "Collapse contents"}
        >
          {collapsed ? "▶" : "▼"}
        </button>

        <div style={{ fontWeight: 700, flex: 1, fontSize: 13 }}>Contents</div>

        <div style={{ fontSize: 11, color: "#6b778c" }}>{VERSION_LABEL}</div>

        {toc?.canEdit ? (
          <button
            onClick={startEdit}
            style={{
              border: "1px solid #dfe1e6",
              background: "#fff",
              borderRadius: 6,
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 12,
            }}
            type="button"
          >
            Edit
          </button>
        ) : null}
      </div>

      {error ? (
        <div style={{ marginTop: 4, color: "#ae2a19", fontSize: 12 }}>
          {error}
        </div>
      ) : null}

      {collapsed ? null : !editing ? (
        <div style={{ marginTop: 6 }}>
          {!hasData ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  height: 24,
                  width: 120,
                  background: "#f1f2f4",
                  borderRadius: 999,
                }}
              />
              <div
                style={{
                  height: 24,
                  width: 90,
                  background: "#f1f2f4",
                  borderRadius: 999,
                }}
              />
              <div
                style={{
                  height: 24,
                  width: 110,
                  background: "#f1f2f4",
                  borderRadius: 999,
                }}
              />
            </div>
          ) : visibleItems.length === 0 ? (
            <div style={{ color: "#6b778c", fontSize: 13 }}>
              No H1–H2 headings found.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              {visibleItems.map((it) => {
                const style = chipStyleForLevel(it.level);

                return (
                  <button
                    key={it.key}
                    onClick={() => jumpToAnchor(it.anchorId)}
                    style={{
                      display: "inline-block",
                      padding: "3px 9px",
                      border: `1px solid ${style.borderColor}`,
                      borderRadius: 999,
                      color: style.color,
                      fontSize: style.fontSize,
                      fontWeight: style.fontWeight,
                      background: style.background,
                      maxWidth: 360,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      cursor: "pointer",
                    }}
                    title={it.label}
                    type="button"
                  >
                    {it.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {(toc?.items || []).map((it) => {
              const shown = !draftHidden.has(it.key);
              const draft = draftLabels[it.key] ?? "";

              return (
                <div
                  key={it.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    alignItems: "center",
                    columnGap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={shown}
                    onChange={(e) => {
                      const next = new Set(draftHidden);
                      if (e.target.checked) next.delete(it.key);
                      else next.add(it.key);
                      setDraftHidden(next);
                    }}
                    aria-label={`Show ${it.text}`}
                  />

                  <div>
                    <div style={{ fontSize: 12, color: "#6b778c" }}>
                      {it.text} (H{it.level})
                    </div>
                    <input
                      type="text"
                      value={draft}
                      placeholder={it.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftLabels((prev) => ({ ...prev, [it.key]: v }));
                      }}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #dfe1e6",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={saveEdit}
              style={{
                border: "1px solid #0052cc",
                background: "#0052cc",
                color: "#fff",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
              }}
              type="button"
            >
              Save
            </button>

            <button
              onClick={() => setEditing(false)}
              style={{
                border: "1px solid #dfe1e6",
                background: "#fff",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}