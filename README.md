---
title: SB 54 Compliance Navigator
subtitle: A Governed Answer Retrieval (GAR) portal for California's Plastic EPR law
author: Robin
date: 2026-07-04
version: v0.2 (all six panels live and serving; multi-source data, a portable Excel instrument, and a client-side compiler planned in docs/plan_V3.md v3.2)
status: Working draft. Content dated 2026-07-03; verify against current CalRecycle and CAA guidance and active litigation before relying.
source_files: content_factory/sources/sb54_bill/SB54_workbook.xlsx (Claude-validated); content_factory/sources/sb54_bill/billPdf.xhtml_cleanfinal.md
---

# SB 54 Compliance Navigator

A free, static, citable navigator for California SB 54, the Plastic Pollution Prevention and Packaging Producer Responsibility Act (Chapter 75, Statutes of 2022; PRC §42040 et seq.). It turns hundreds of pages of statute, regulation, and program rules into something a producer can use under deadline: the whole law, filterable down to the obligations that bind them. Live at https://rbndchsn.github.io/sb_portal/.

It is built on Governed Answer Retrieval (GAR), the same architecture as the SBTi Corporate Net-Zero portal. Content is drafted and expert-approved in a private factory, then served read-only. There is no LLM at runtime, no retrieval-time generation, and therefore no hallucination surface. The trust is built into the pipeline, not the prompt.

Governing plan and live status: `docs/plan_V3.md` (v3.2), which supersedes `docs/plan_V2.md` (v2.0) and `docs/PLAN.md` (v0.5) and governs one source-governed obligation system rendered as this GAR site, a portable Excel instrument, and a client-side compiler. Write-path reference (Phase L issue-capture only): `docs/GitHub_as_Backend_Spec_agnostic_v1.md`. This README describes the site as built; `docs/plan_V3.md` holds current status and next steps, so this file is not the place to track progress.

## What it does

1. Requirements Explorer: every operative "shall" obligation in SB 54 (486 rows), in bill order, fully traceable to the source line. Filter by who it binds (producer or PRO, monitor-only, or needs-review), by responsible party, and by article, or free-text search. 182 obligations fall on producers or PROs; the Explorer isolates them in one click.
2. Approved Answers: vetted Q&A for the recurring real-world questions. Drafted and approved before publication, then served verbatim. 66 approved answers are published. Built via the content factory (see below).
3. Operational Compliance Calendar: the statutory milestones plus the regulatory and CAA-administered dates created by the 1 May 2026 permanent regulations, with a live litigation watch (two filed suits plus the Oregon precedent).
4. Producer Pathways and Key Facts: the three registration pathways, the producer definition and hierarchy, exclusion versus exemption, performance targets, fees and the $500M surcharge, and enforcement.
5. Sources: numbered, dated, linked primary and secondary sources.
6. Validation and Trust: per-section reliability ratings, how each was built, where it can be wrong, and what a human still has to verify.

## Architecture (workbook to extractor to read-only JSON to static site)

The working folder holds both the private factory and the published site. Only the site files at the repo root are pushed to GitHub; the factory, tools, and internal docs are gitignored and stay local.

```
sb54-portal/
    (Published: the repo root IS the site GitHub Pages serves)
├── index.html
├── css/style.css
├── js/app.js               Loads ./data/*.json; drives all panels. No framework.
├── data/                   Read-only JSON. Generated: do not hand-edit.
│   ├── requirements.json   meta.json   calendar.json
│   ├── pathways.json   sources.json   validation.json
│   └── answers.json        Approved Q&A only (approved rows from answers.csv).
├── .nojekyll
├── .github/workflows/pages.yml   Deploys the repo root to Pages via GitHub Actions on push.
├── README.md
│
│   (Private: gitignored, never pushed to the public repo)
├── content_factory/
│   ├── sources/            Source documents in per-authority-tier subfolders: sb54_act/,
│   │                       sb54_bill/ (workbook + clean bill text), sb54_regulation/,
│   │                       calrecycle_guidance/*, caa/program_plan/, secondary/.
│   ├── extraction/         extract_sb54.py, build_answers.py, make_answers_json.py,
│   │                       capture_act.py (re-runnable statute capture).
│   └── staging/            answers.csv (the Q&A bank with approval status).
├── tools/build.sh          One-command re-emit of the data files.
└── docs/                   plan_V3.md (governing plan), plan_V2.md and PLAN.md (superseded), PUBLISH.md, write-path spec.
```

Source of truth is the workbook (a Google Sheet in production). The extractor reads it and writes the JSON the site serves. The JSON is disposable output; to change content, change the workbook and re-run the extractor. The site itself has no build step; open `index.html` and it runs.

Two guardrails to know before editing: never hand-edit `data/*.json` (it is generated), and never re-run `content_factory/extraction/build_answers.py` against the approved `answers.csv` (it resets every row to draft). To publish answers, edit `answers.csv`, then run `make_answers_json.py` without `--include-drafts`.

## Rebuild the data

```bash
# 1. rebuild the six reference JSON files from the workbook
python3 content_factory/extraction/extract_sb54.py \
        content_factory/sources/sb54_bill/SB54_workbook.xlsx \
        data
# 2. re-emit the approved answers (omit --include-drafts to publish approved only)
python3 content_factory/extraction/make_answers_json.py \
        content_factory/staging/answers.csv data/answers.json
# 3. emit the register-derived JSON (rules.json, changelog.json) and merge the
#    register-versioning keys into meta.json (additive; workbook JSON untouched)
python3 content_factory/extraction/extract_registers.py
# 4. run the full local register gate (schema, keys, references, vocab, dates,
#    primary-trace, counts); exits non-zero on any failure
python3 content_factory/validation/validate_registers.py
# or run all four in order via the helper (aborts if the validator fails):
bash tools/build.sh
```

Requires `openpyxl` for step 1 (`pip install openpyxl --break-system-packages`); steps 2 to 4 are pure standard library. The site itself needs nothing installed.

## Deploy (GitHub Pages via GitHub Actions)

The site lives at the repository root and is deployed by a GitHub Actions workflow (`.github/workflows/pages.yml`): on every push to `main` a `validate` job runs first, and the `deploy` job depends on it (`needs: validate`), so a failing check skips the deploy and the last good site keeps serving. One-time setup: Settings > Pages > Build and deployment > Source set to "GitHub Actions" (the workflow also self-enables this via `actions/configure-pages`). Use the GitHub Actions source, not "Deploy from a branch"; the two are mutually exclusive, and the workflow is the source of truth for this repo. The `.nojekyll` file keeps Jekyll from touching the assets. Live at https://rbndchsn.github.io/sb_portal/.

Validation has two points, by design. The **full register gate** (`content_factory/validation/validate_registers.py`) runs locally, because the source-truth registers are gitignored and never reach GitHub; it is the real gate and the local build refuses to finish clean when it fails. The **published-JSON backstop** (`ci/validate_published_json.py`) runs in GitHub Actions and only checks that the committed `data/*.json` parse and carry their expected shape; its job is to stop a broken `data/*.json` from going live, not to re-check the registers. Both are pure standard library.

Note on the git path: the `.git` folder is on a Google-Drive-synced path, so clear any `.git/*.lock` files on the Mac before pushing. See `docs/PUBLISH.md`.

## Honest limitations

SB 54 is under active litigation: a federal suit by 17 state AGs plus NAW seeks to block enforcement, and an NGO coalition is challenging the regulations from the other side. The operational calendar is the most perishable layer and is dated 2026-07-03; re-verify anything dated near today before relying. Company-facing flags and section-level citations are first-pass and need a human or counsel read. This is compliance-support material, not legal advice.
