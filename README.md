# Confluence TOC Banner (Forge) — Internal

A Forge app for **Confluence Cloud** that renders an always-on-page **Page Banner** showing a compact Table of Contents for the current page.

**What it does**

* Extracts **H1 + H2** headings from the page
* Renders them as compact “chips” in a **page banner**
* Supports headings starting with Confluence emoji/emoticons (e.g. 👥, 🎨)
* Clicking a chip navigates to the corresponding heading anchor

> **Note on reload behavior**
> Confluence may re-render the banner iframe when the page hash changes. This is expected for the Page Banner surface. Cached data is used so the re-render appears instant.

---

## Repository layout

```
.
├─ manifest.yml              # Forge app manifest
├─ src/index.js               # Backend resolver (heading extraction + storage)
├─ static/page-banner/        # Custom UI frontend (Page Banner)
└─ package.json               # Backend dependencies (@forge/api, @forge/resolver)
```

---

## Prerequisites

* Node.js (Forge-compatible; **Node 20 recommended**)
* Forge CLI installed and authenticated:

  ```bash
  npm i -g @forge/cli
  forge login
  ```
* Admin access to a Confluence Cloud site

---

## Installation & build

<details>
<summary><strong>Install dependencies</strong></summary>

From the repo root:

```bash
npm install
```

Frontend (Custom UI):

```bash
cd static/page-banner
npm install
```

</details>

<details>
<summary><strong>Build the frontend</strong></summary>

```bash
cd static/page-banner
npm run build
```

Produces a `build/` directory served by Forge via `resources.path` in `manifest.yml`.

</details>

---

## Deploy & install

<details>
<summary><strong>Development environment (testing)</strong></summary>

```bash
forge deploy
forge install
```

Upgrade an existing install:

```bash
forge deploy
forge install --upgrade
```

</details>

<details>
<summary><strong>Production environment (recommended for internal use)</strong></summary>

```bash
forge deploy --environment production
forge install --environment production
```

Upgrade later:

```bash
forge deploy --environment production
forge install --upgrade --environment production
```

**Note:**
The Forge CLI may warn when installing a development app into a production Confluence site. For internal rollout, use the **Forge production environment**.

</details>

---

## Using the banner in Confluence

This app uses the **Confluence Page Banner** surface—there is **no macro** to insert.

Once installed and enabled, the banner appears automatically at the top of Confluence pages.

---

## Data handling (high level)

* Reads the current page’s **storage body** to extract headings
* Stores per-page overrides (hidden headings, custom labels) in **Forge storage**, keyed by page ID
* No third-party data sharing

See the Privacy Policy configured in the Atlassian Developer Console.

---

## Version label

The banner shows a small version label in the top-right (e.g. `2026-01-12-v7-cached`).
This is a frontend string used to confirm the deployed UI is current.

The backend also maintains its own internal version constant (not always displayed).

---

## Troubleshooting

<details>
<summary><strong>Banner doesn’t appear</strong></summary>

* Confirm the app is installed on the same Confluence site you’re viewing
* Confluence admin: **Settings → Manage apps** → ensure the app is enabled
* Reinstall/upgrade:

  ```bash
  forge install --upgrade
  ```

</details>

<details>
<summary><strong>Headings don’t jump correctly</strong></summary>

* Confluence anchors can differ from simple slugification, especially with emoji
* This app supports Confluence storage emoticons via `ac:emoticon` and uses
  `ac:emoji-fallback` to generate correct anchor fragments

</details>

<details>
<summary><strong>Logs while testing</strong></summary>

```bash
forge logs
```

Occasional `404` entries are normal. The Page Banner can render in contexts where a page ID is unavailable; the resolver handles these cases quietly.

</details>

---

## Development notes

<details>
<summary><strong>Frontend</strong></summary>

* Location: `static/page-banner/src/App.jsx`
* Uses `@forge/bridge` for backend calls and navigation

</details>

<details>
<summary><strong>Backend</strong></summary>

* Location: `src/index.js`
* Uses **Confluence REST API v2** to fetch the page in storage format
* Extracts `<h1>` / `<h2>` headings

</details>

---

## Sharing internally (review & collaboration)

* Push this repo to GitHub (**private recommended**)
* Add collaborators for review
* To let another admin install on another Confluence site:

  * Add them as a contributor to the Forge app in Developer Console, **or**
  * Install it yourself using `forge install` targeting their site, **or**
  * Publish as a private Marketplace listing (optional; heavier process)

---

## License

Internal use only.