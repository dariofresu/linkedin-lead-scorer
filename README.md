# ⚡ LinkedIn Lead Scorer — Chrome Extension

> Scores LinkedIn connection requests against Avatar A & B for **Fresu Electronics** (Dario Fresu, Principal EMC Architect).

---

## What it does

Opens as a Chrome side panel. When you're on LinkedIn's invitation manager, one click:
1. Auto-scrolls the page to load all pending requests
2. Extracts every profile (name, title, company, URL)
3. Scores each one with AI against Avatar A & B criteria
4. Shows a dashboard with Strong Lead / Possible Lead / Skip + recommended action

---

## Install (one time)

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-lead-scorer.git
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the cloned folder
4. ⚡ appears in your toolbar

---

## Update (when I push changes)

```bash
cd linkedin-lead-scorer
git pull
```

Then in Chrome → `chrome://extensions` → click the **↺ reload** button on the extension card.

Or use the **Check for updates** button inside the extension settings — it tells you when a new version is available.

---

## Setup

1. Click ⚡ in your toolbar → side panel opens
2. Select your AI provider (OpenRouter recommended — free)
3. Paste your API key (get one free at [openrouter.ai/keys](https://openrouter.ai/keys))
4. Go to [linkedin.com/mynetwork/invitation-manager/received/](https://www.linkedin.com/mynetwork/invitation-manager/received/)
5. Click **Scan Connection Requests**

---

## Avatar scoring logic

| Avatar | Profile | Offers |
|--------|---------|--------|
| **B (primary)** | Head of Dev, Engineering Director, VP Engineering, CTO, R&D Manager at hardware/electronics company (15–200 people) | EMC Design Audit €8K / Architect System €30K/mo |
| **A (secondary)** | Individual hardware/PCB/embedded engineer | Courses only (~€2K ceiling) |
| **Skip** | Recruiters, marketers, pure software, students, competitors | — |

---

## AI Providers (all free)

| Provider | Free tier | Get key |
|----------|-----------|---------|
| OpenRouter | Many models, generous limits | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Groq | 30 req/min, Llama 3.3 70B | [console.groq.com/keys](https://console.groq.com/keys) |
| Gemini Flash | 1500 req/day | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Claude Haiku | Included in Claude.ai plan | No key needed |

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config & permissions |
| `background.js` | Opens side panel on click, tracks tab changes |
| `content.js` | Injected into LinkedIn — scrolls & extracts profiles |
| `sidepanel.html` | Side panel UI shell |
| `sidepanel.js` | Full dashboard logic, AI scoring, settings |

---

*Built by Claude for Dario Fresu · Fresu Electronics*
