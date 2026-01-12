import Resolver from "@forge/resolver";
import api, { route, storage } from "@forge/api";
import * as cheerio from "cheerio";

const resolver = new Resolver();

const OVERRIDES_KEY = (contentId) => `tocOverrides:${contentId}`;
const BACKEND_VERSION = "2026-01-12-emoji-v6-quiet";

function keySlug(input) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function computeKeys(headings) {
  const counts = new Map();
  return headings.map((h) => {
    const slug = keySlug(h.text);
    const n = (counts.get(slug) || 0) + 1;
    counts.set(slug, n);
    return { ...h, key: `${slug}::${n}` };
  });
}

function normalizeFragmentRest(rest) {
  return (rest || "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

async function fetchPageV2(contentId, format) {
  const res = await api
    .asApp()
    .requestConfluence(
      route`/wiki/api/v2/pages/${contentId}?body-format=${format}`
    );

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function extractHeadingsH1H2FromStorage(storageHtml) {
  const headings = [];
  const $ = cheerio.load(storageHtml || "", {
    xmlMode: false,
    decodeEntities: true,
  });

  $("h1, h2").each((_, el) => {
    const $h = $(el);
    const tag = ($h.get(0)?.tagName || "").toLowerCase();
    const level = Number(tag.replace("h", ""));

    const fullText = $h.text().replace(/\s+/g, " ").trim();
    if (!fullText) return;

    let anchorId =
      $h.attr("id") ||
      $h.find("a[id]").first().attr("id") ||
      $h.find("a[name]").first().attr("name") ||
      null;

    const $emoticon = $h.find("ac\\:emoticon[ac\\:emoji-fallback]").first();
    const emojiFallback = $emoticon.attr("ac:emoji-fallback") || null;

    let restText = fullText;
    if ($emoticon.length) {
      const $clone = $h.clone();
      $clone.find("ac\\:emoticon").remove();
      restText = $clone.text().replace(/\s+/g, " ").trim();
    }

    if (!anchorId) {
      const rest = normalizeFragmentRest(restText || fullText);
      anchorId = emojiFallback
        ? rest
          ? `${emojiFallback}-${rest}`
          : emojiFallback
        : rest;
    }

    headings.push({ level, text: fullText, anchorId });
  });

  return headings;
}

async function userCanEditContent(contentId) {
  try {
    const res = await api
      .asUser()
      .requestConfluence(
        route`/wiki/rest/api/content/${contentId}/permission/check?operation=update`
      );
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.hasPermission);
  } catch {
    return false;
  }
}

function getNumericPageIdFromContext(context) {
  const candidates = [
    context?.extension?.content?.id,
    context?.extension?.contentId,
    context?.contentId,
    context?.extension?.page?.id,
    context?.extension?.pageId,
  ];

  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
    if (typeof c === "string" && /^\d+$/.test(c.trim())) return c.trim();
  }

  return null;
}

resolver.define("getToc", async ({ context }) => {
  const contentId = getNumericPageIdFromContext(context);

  if (!contentId) {
    return {
      backendVersion: BACKEND_VERSION,
      contentId: null,
      canEdit: false,
      pageUrl: null,
      items: [],
    };
  }

  const canEdit = await userCanEditContent(contentId);

  const pageRes = await fetchPageV2(contentId, "storage");
  if (!pageRes.ok) {
    return {
      backendVersion: BACKEND_VERSION,
      contentId,
      canEdit,
      pageUrl: null,
      items: [],
    };
  }

  const page = JSON.parse(pageRes.text);
  const storageHtml = page?.body?.storage?.value || "";

  const raw = extractHeadingsH1H2FromStorage(storageHtml);
  const headings = computeKeys(raw);

  const webui = page?._links?.webui || "";
  const pageUrl = webui.startsWith("/wiki") ? webui : `/wiki${webui}`;

  const overrides =
    (await storage.get(OVERRIDES_KEY(contentId))) || {
      version: 1,
      hiddenKeys: [],
      labelByKey: {},
    };

  const hiddenSet = new Set(overrides.hiddenKeys || []);
  const labelByKey = overrides.labelByKey || {};

  const items = headings.map((h) => ({
    key: h.key,
    level: h.level,
    text: h.text,
    anchorId: h.anchorId,
    hidden: hiddenSet.has(h.key),
    label: (labelByKey[h.key] || "").trim() || h.text,
  }));

  return {
    backendVersion: BACKEND_VERSION,
    contentId,
    canEdit,
    pageUrl,
    items,
  };
});

resolver.define("saveOverrides", async ({ payload, context }) => {
  const contentId =
    (payload?.contentId && String(payload.contentId)) ||
    getNumericPageIdFromContext(context);

  if (!contentId) return { ok: false, error: "No page context." };

  const canEdit = await userCanEditContent(contentId);
  if (!canEdit) return { ok: false, error: "No permission to edit." };

  const hiddenKeys = Array.isArray(payload?.hiddenKeys)
    ? payload.hiddenKeys
    : [];
  const labelByKey =
    payload?.labelByKey && typeof payload.labelByKey === "object"
      ? payload.labelByKey
      : {};

  const sanitizedLabelByKey = {};
  for (const [k, v] of Object.entries(labelByKey)) {
    if (typeof k !== "string") continue;
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    sanitizedLabelByKey[k] = trimmed.slice(0, 200);
  }

  await storage.set(OVERRIDES_KEY(contentId), {
    version: 1,
    hiddenKeys: hiddenKeys.filter((k) => typeof k === "string"),
    labelByKey: sanitizedLabelByKey,
  });

  return { ok: true };
});

export const handler = resolver.getDefinitions();