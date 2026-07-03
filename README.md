---
title: SB 54 Compliance Navigator
subtitle: A Governed Answer Retrieval (GAR) portal for California's Plastic EPR law
author: Robin
date: 2026-07-03
version: v0.1 (scaffold + Requirements Explorer live from workbook)
status: Working draft — content dated 2026-06-24; verify against current CalRecycle/CAA guidance and active litigation before relying
source_files: SB54_Company_Compliance_Workbook_v3_MERGED (Claude-validated)
---

# SB 54 Compliance Navigator

A free, static, **citable** navigator for California **SB 54** — the Plastic
Pollution Prevention and Packaging Producer Responsibility Act (Chapter 75,
Statutes of 2022; PRC §42040 et seq.). It turns hundreds of pages of statute,
regulation, and program rules into something a producer can actually use under
deadline: the whole law, filterable down to the obligations that bind *them*.

It is built on **Governed Answer Retrieval (GAR)** — the same architecture as the
SBTi Corporate Net-Zero portal. Content is drafted and expert-approved in a
private factory, then served **read-only**. There is no LLM at runtime, no
retrieval-time generation, and therefore no hallucination surface. The trust is
built into the pipeline, not the prompt.

## What it does

1. **Requirements Explorer** — every operative "shall" obligation in SB 54 (486
   rows), in bill order, fully traceable to the source line. Filter by *who it
   binds* (producer/PRO vs monitor-only vs needs-review), by *responsible party*,
   and by *article*, or free-text search. 182 obligations fall on producers/PROs;
   the Explorer isolates them in one click.
2. **Approved Answers** *(scaffold)* — vetted Q&A for the recurring real-world
   questions. Drafted and approved before publication; served verbatim. Built via
   the content factory (see below).
3. **Operational Compliance Calendar** — the statutory milestones *plus* the
   regulatory and CAA-administered dates created by the 1 May 2026 permanent
   regulations, with a live **litigation watch** (two filed suits + the Oregon
   precedent).
4. **Producer Pathways & Key Facts** — the three registration pathways, the
   producer definition and hierarchy, exclusion-vs-exemption, performance targets,
   fees and the $500M surcharge, and enforcement.
5. **Sources** — numbered, dated, linked primary/secondary sources.
6. **Validation & Trust** — per-section reliability ratings, how each was built,
   where it can be wrong, and what a human still has to verify.

## Architecture (Sheet → CSV → JSON → static site)

```
sb54-portal/
├── content_factory/         PRIVATE. Never published (Pages serves /public only).
│   ├── sources/             The SB 54 workbook (source of truth) + bill text.
│   ├── extraction/
│   │   └── extract_sb54.py  Deterministic: workbook → public/data/*.json.
│   └── staging/             Draft Q&A candidates awaiting review (factory output).
├── tools/
│   └── build.sh             One-command re-emit of the data files.
├── public/                  THE SITE. This is what GitHub Pages serves.
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js            Loads ./data/*.json; drives all panels. No framework.
│   └── data/                Read-only JSON. Generated — do not hand-edit.
│       ├── requirements.json
│       ├── meta.json
│       ├── calendar.json
│       ├── pathways.json
│       ├── sources.json
│       └── validation.json
├── docs/
│   └── PLAN.md
└── README.md
```

**Source of truth is the workbook** (a Google Sheet in production). The extractor
reads it and writes the JSON the site serves. The JSON is disposable output — to
change content, change the workbook and re-run the extractor. The site itself has
no build step: open `public/index.html` and it runs.

## Rebuild the data

```bash
python3 content_factory/extraction/extract_sb54.py \
        content_factory/sources/SB54_workbook.xlsx \
        public/data
# or:
bash tools/build.sh
```

Requires `openpyxl` (`pip install openpyxl --break-system-packages`). No other
dependencies. The site itself needs nothing installed.

## Deploy (GitHub Pages, branch deploy)

The site lives at the repository root, so GitHub Pages serves it directly with no
build step. One-time setup: Settings > Pages > Build and deployment > Source set
to "Deploy from a branch", Branch `main`, Folder `/ (root)`. Every push to `main`
redeploys. The `.nojekyll` file keeps Jekyll from touching the assets. Live at
`https://rbndchsn.github.io/sb_portal/`.

## Honest limitations

SB 54 is under **active litigation** — a federal suit by 17 state AGs + NAW seeks
to block enforcement, and an NGO coalition is challenging the regulations from the
other side. The operational calendar is the most perishable layer and is dated
**2026-06-24**; re-verify anything dated near today before relying. Company-facing
flags and section-level citations are first-pass and need a human/counsel read.
This is compliance-support material, **not legal advice**.
