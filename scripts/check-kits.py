#!/usr/bin/env python3
"""Every KitPad id must exist as an element id in that profile's schematic.

The preview marks drums by id, so a profile whose pads have drifted from its
picture breaks in two places at once — the wizard highlights nothing during
capture, and the lesson page lights nothing during a run — and both fail
silently. Cheaper to fail the build.

Run from `pnpm check` and `pnpm build`.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRESETS = ROOT / "src/lib/presets.ts"


def bracket_block(text: str, start: int) -> str:
    """The contents of the [...] beginning at or after `start`."""
    open_at = text.index("[", start)
    depth = 0
    for i in range(open_at, len(text)):
        if text[i] == "[":
            depth += 1
        elif text[i] == "]":
            depth -= 1
            if depth == 0:
                return text[open_at + 1 : i]
    return ""


def corner_block(text: str, start: int, end: int) -> dict[str, str]:
    """The `corners: { ... }` object between `start` and `end`, if present."""
    at = text.find("corners:", start)
    if at == -1 or at > end:
        return {}
    close = text.index("}", at)
    return dict(
        re.findall(r'\b(topLeft|topRight|bottomLeft|bottomRight):\s*"([^"]+)"',
                   text[at:close])
    )


def read_profiles(src: str) -> list[dict]:
    """The profiles are a plain literal, so they can be read without a
    TypeScript parser. Anchored on `schematic:` — the one key every profile has
    and nothing else in the file does — then walked outward."""
    profiles = []
    at = src.find("schematic:", src.find("KIT_PROFILES"))
    while at != -1:
        ids_before = re.findall(r'\bid:\s*"([^"]+)"', src[:at])
        schematic = re.search(r'schematic:\s*(null|"([^"]*)")', src[at:])
        pads_at = src.find("pads:", at)
        profiles.append(
            {
                "id": ids_before[-1] if ids_before else "(unnamed)",
                "schematic": schematic.group(2) if schematic else None,
                "corners": corner_block(src, at, pads_at),
                "pads": re.findall(
                    r'\bid:\s*"([^"]+)"', bracket_block(src, pads_at)
                ),
            }
        )
        at = src.find("schematic:", at + 1)
    return profiles


def main() -> int:
    profiles = read_profiles(PRESETS.read_text())
    if not profiles:
        print(f"check-kits: no kit profiles found in {PRESETS}", file=sys.stderr)
        return 1

    failed = False
    for profile in profiles:
        # A corner naming a pad the profile does not declare can never resolve,
        # so the gesture would be silently dead. Cheaper to fail here.
        corners = profile.get("corners") or {}
        if corners:
            unknown = sorted(
                {v for v in corners.values() if v not in profile["pads"]}
            )
            if unknown:
                print(
                    f"check-kits: {profile['id']} — corner names no pad: "
                    + ", ".join(unknown),
                    file=sys.stderr,
                )
                failed = True
            missing_sides = sorted(
                {"topLeft", "topRight", "bottomLeft", "bottomRight"}
                - set(corners)
            )
            if missing_sides:
                print(
                    f"check-kits: {profile['id']} — corners incomplete, "
                    "missing: " + ", ".join(missing_sides),
                    file=sys.stderr,
                )
                failed = True

        if not profile["schematic"]:
            print(f"check-kits: {profile['id']} — no schematic, neutral layout")
            continue

        path = ROOT / "static" / profile["schematic"].lstrip("/")
        if not path.exists():
            print(
                f"check-kits: {profile['id']} — missing schematic {path}",
                file=sys.stderr,
            )
            failed = True
            continue

        svg = path.read_text()
        ids = set(re.findall(r'\bid="([^"]+)"', svg))
        missing = [p for p in profile["pads"] if p not in ids]
        if missing:
            print(
                f"check-kits: {profile['id']} — schematic has no drum for: "
                + ", ".join(missing),
                file=sys.stderr,
            )
            failed = True

        # The other direction: a drum drawn with no pad behind it can never light.
        drums = re.findall(r'<g\s+id="([^"]+)"\s+class="drum', svg)
        orphans = [d for d in drums if d not in profile["pads"]]
        if orphans:
            print(
                f"check-kits: {profile['id']} — schematic draws drums with no "
                "pad: " + ", ".join(orphans),
                file=sys.stderr,
            )
            failed = True

        if not missing and not orphans:
            corner_note = " + corners" if corners else " (no corners)"
            print(
                f"check-kits: {profile['id']} — {len(profile['pads'])} pads"
                f"{corner_note} ✓"
            )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
