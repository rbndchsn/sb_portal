#!/usr/bin/env python3
"""
validate_published_json.py: deploy-blocking backstop on the published site data.

This runs in GitHub Actions before the Pages deploy. The public repo contains
only the static site and data/*.json; the source-truth registers and the full
local validator (content_factory/validation/validate_registers.py) are gitignored
and never reach GitHub. So this check is NOT a register check: it is the last line
that stops a broken or malformed data/*.json from going live. If it fails, the
deploy job is skipped and the last good site keeps serving.

Pure Python standard library, so the CI runner needs no pip install.

Usage:
    python3 ci/validate_published_json.py [data_dir]
data_dir defaults to <repo_root>/data. Exit 0 = all checks pass.
"""
import json, os, sys


def load(data_dir, name):
    with open(os.path.join(data_dir, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "data")

    fails = []

    # 1. Every data/*.json must parse.
    parsed = {}
    if not os.path.isdir(data_dir):
        print(f"FAIL: data dir not found: {data_dir}")
        sys.exit(1)
    for fn in sorted(os.listdir(data_dir)):
        if not fn.endswith(".json"):
            continue
        try:
            parsed[fn] = load(data_dir, fn)
        except (ValueError, OSError) as e:
            fails.append(f"{fn}: does not parse as JSON ({e})")

    def need(fn):
        if fn not in parsed:
            fails.append(f"{fn}: missing or unparseable")
            return None
        return parsed[fn]

    # 2. Expected top-level shapes.
    req = need("requirements.json")
    if req is not None:
        if not isinstance(req, list) or not req:
            fails.append("requirements.json: expected a non-empty list")
        else:
            # 3. Light internal check: no record with an empty req_id.
            empties = [i for i, r in enumerate(req)
                       if not (isinstance(r, dict) and str(r.get("req_id", "")).strip())]
            if empties:
                fails.append(f"requirements.json: {len(empties)} record(s) with an "
                             f"empty req_id (first at index {empties[0]})")

    meta = need("meta.json")
    if meta is not None:
        if not isinstance(meta, dict):
            fails.append("meta.json: expected an object")
        else:
            for k in ("register_version", "schema_version", "source_content_date",
                      "counts"):
                if k not in meta:
                    fails.append(f"meta.json: missing required key {k!r}")

    for name in ("rules.json", "changelog.json"):
        v = need(name)
        if v is not None and not isinstance(v, list):
            fails.append(f"{name}: expected a list")

    ans = need("answers.json")
    if ans is not None and not (isinstance(ans, dict)
                                and isinstance(ans.get("answers"), list)):
        fails.append("answers.json: expected an object carrying an 'answers' list")

    # These must parse and be non-empty (a list with items, or an object with keys).
    for name in ("calendar.json", "pathways.json", "sources.json", "validation.json"):
        v = need(name)
        if v is not None and not v:
            fails.append(f"{name}: parsed but is empty")

    if fails:
        print("Published JSON validation: FAIL")
        for m in fails:
            print(f"  - {m}")
        print("\nDeploy blocked; the last good site keeps serving.")
        sys.exit(1)

    print(f"Published JSON validation: PASS ({len(parsed)} files checked in {data_dir})")
    sys.exit(0)


if __name__ == "__main__":
    main()
