#!/usr/bin/env python3
"""Regenerate: pip install pdfplumber; python scripts/extract-deer-elk.py server/src/etl/deer-elk-districts-2026.json

Clean re-extraction of the 2026 DEA deer/elk per-district regs (printed pp.48-123,
PDF pages 44-116) using pdfplumber's cell-border table extraction. Emits JSON in the same
shape as the original hunting-district-regulations.json so loadDeaJson consumes it unchanged,
but with correct column mapping and no dropped/garbled rows."""
import json, re, sys
import pdfplumber

# Download the current DEA regulations PDF from fwp.mt.gov and point this at it.
PDF = "2026-dea-regulations-final-with-low-resolution-maps-for-web.pdf"
FIRST, LAST = 43, 118  # 0-indexed PDF pages 44..116

HEADER0 = "LICENSE/PERMIT"
CLEAN_CLASS = re.compile(
    r"(Deer|Elk|Bull|Buck|Antlerless|Either-sex|Spike|Brow-tined)", re.I)

def cell(v):
    return (v or "").replace("\n", " ").strip()

def dash(v):
    v = cell(v)
    return None if v in ("", "-") else v

rows_out = []
hd = name = note = species = zone = license_ = None
notes_by_hd = {}

def is_species_header(c0):
    # Case-insensitive: catches plain "DEER"/"ELK", zone splits ("DEER Outside the Weapons
    # Restriction Area"), and drawing-only variants ("Elk Hunting by Drawing Only").
    return re.match(r"^(DEER|ELK)\b", c0, re.I)

def species_from_license(lic):
    if not lic:
        return None
    if re.search(r"\bElk\b", lic):
        return "ELK"
    if re.search(r"\bDeer\b", lic):
        return "DEER"
    return None

with pdfplumber.open(PDF) as pdf:
    for pi in range(FIRST, LAST + 1):
        for tbl in pdf.pages[pi].extract_tables():
            for row in tbl:
                if not row or len(row) < 11:
                    continue
                c0 = cell(row[0])
                c1 = cell(row[1])
                if c0 == HEADER0:
                    continue
                # District header
                m = re.match(r"^HD\s+(\d{3})\s*-\s*(.*)$", c0, re.S)
                if m:
                    hd = m.group(1)
                    rest = m.group(2).replace("\n", " ").strip()
                    # split off NOTE
                    nm = re.split(r"\bNOTE:\s*", rest, maxsplit=1)
                    name = nm[0].strip(" -")
                    note = nm[1].strip() if len(nm) > 1 else None
                    if note:
                        notes_by_hd.setdefault(hd, [])
                        if note not in notes_by_hd[hd]:
                            notes_by_hd[hd].append(note)
                    species = zone = license_ = None
                    continue
                # Species section header (may carry a zone: "DEER Outside the Weapons...")
                if is_species_header(c0) and not c1:
                    sp = "DEER" if c0.upper().startswith("DEER") else "ELK"
                    species = sp
                    z = c0[len(sp):].strip()
                    zone = z or None
                    license_ = f"General {'Deer' if sp=='DEER' else 'Elk'} License"
                    continue
                # Data row: needs an opportunity (a real animal class)
                if c1 and CLEAN_CLASS.search(c1) and species and hd:
                    lic = c0 if c0 else license_
                    if c0 and re.search(r"License|Permit", c0):
                        license_ = c0  # update the carried license
                        lic = c0
                    # Robustness: the license text always names its species — trust it over the
                    # carried section-header species (guards against a missed/variant header,
                    # e.g. HD 700's "Elk Hunting by Drawing Only").
                    row_species = species_from_license(lic) or species
                    restr = dash(row[10])
                    # fold the zone into the restriction so it's never lost
                    if zone:
                        restr = (restr + f" [{zone}]") if restr else zone
                    rows_out.append({
                        "hd": hd,
                        "districtName": name,
                        "region": int(hd[0]),
                        "species": row_species,
                        "license": (lic or "").replace("\n", " ").strip() or None,
                        "opportunity": c1,
                        "applyByDate": dash(row[2]),
                        "quota": dash(row[3]),
                        "quotaRange": dash(row[4]),
                        "earlySeasonDates": dash(row[5]),
                        "archeryDates": dash(row[6]),
                        "generalDates": dash(row[7]),
                        "heritageMuzzleloaderDates": dash(row[8]),
                        "lateSeasonDates": dash(row[9]),
                        "opportunitySpecific": restr,
                        "districtNotes": notes_by_hd.get(hd, []),
                        "rawRow": " | ".join(cell(x) for x in row),
                    })

out = {"_meta": {"pdf": "dea-2026.pdf", "source": "pdfplumber cell-extraction of PDF pp.44-116 (printed 48-123)", "extracted": "2026-07-07"}, "rows": rows_out}
path = sys.argv[1] if len(sys.argv) > 1 else "de-clean.json"
json.dump(out, open(path, "w"), indent=0)
hds = sorted(set(r["hd"] for r in rows_out))
print(f"rows: {len(rows_out)}  districts: {len(hds)}  ({hds[0]}..{hds[-1]})")
from collections import Counter
sp = Counter(r["species"] for r in rows_out)
print("by species:", dict(sp))
print("rows with null license:", sum(1 for r in rows_out if not r["license"]))
