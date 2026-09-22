#!/usr/bin/env python3
"""
Télécharge la première illustration de booster trouvée dans la section "Gallery"
des pages d'extensions Pokémon TCG sur Bulbapedia, puis l'enregistre en WebP.

Usage conseillé depuis la racine du projet :
    python download_pokemon_boosters_bulbapedia.py \
        --db backend/data/pokemon_tcg.sqlite \
        --output r2-assets-template/ui/boosters/pokemon

Dépendances :
    pip install requests beautifulsoup4 pillow

Remarque :
- Si --db pointe vers ta base SQLite, le script essaie de découvrir automatiquement
  la colonne contenant les set codes et utilise EXACTEMENT ces codes comme noms
  de fichiers de sortie.
- Sans --db, il utilise les codes "app_code" du mapping ci-dessous.
"""

from __future__ import annotations

import argparse
import io
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, unquote

import requests
from bs4 import BeautifulSoup
from PIL import Image

BASE = "https://bulbapedia.bulbagarden.net"
API = f"{BASE}/w/api.php"

HEADERS = {
    "User-Agent": (
        "TCGAppBoosterDownloader/1.0 "
        "(personal-development-script; respectful-rate-limit)"
    )
}

REQUEST_DELAY_SECONDS = 1.0


@dataclass(frozen=True)
class SetInfo:
    app_code: str
    name: str
    bulbapedia_page: str
    aliases: tuple[str, ...]


SETS: tuple[SetInfo, ...] = (
    # Sword & Shield
    SetInfo("swsh01", "Sword & Shield", "Sword & Shield (TCG)", ("swsh1", "swsh01", "ssh")),
    SetInfo("swsh02", "Rebel Clash", "Rebel Clash (TCG)", ("swsh2", "swsh02", "rcl")),
    SetInfo("swsh03", "Darkness Ablaze", "Darkness Ablaze (TCG)", ("swsh3", "swsh03", "daa")),
    SetInfo("swsh03.5", "Champion's Path", "Champion's Path (TCG)", ("swsh3.5", "swsh03.5", "swsh35", "cp", "cpa")),
    SetInfo("swsh04", "Vivid Voltage", "Vivid Voltage (TCG)", ("swsh4", "swsh04", "viv")),
    SetInfo("swsh04.5", "Shining Fates", "Shining Fates (TCG)", ("swsh4.5", "swsh04.5", "swsh45", "sf", "shf")),
    SetInfo("swsh05", "Battle Styles", "Battle Styles (TCG)", ("swsh5", "swsh05", "bst")),
    SetInfo("swsh06", "Chilling Reign", "Chilling Reign (TCG)", ("swsh6", "swsh06", "cre")),
    SetInfo("swsh07", "Evolving Skies", "Evolving Skies (TCG)", ("swsh7", "swsh07", "evs")),
    SetInfo("cel25", "Celebrations", "Celebrations (TCG)", ("cel25", "cel")),
    SetInfo("swsh08", "Fusion Strike", "Fusion Strike (TCG)", ("swsh8", "swsh08", "fst")),
    SetInfo("swsh09", "Brilliant Stars", "Brilliant Stars (TCG)", ("swsh9", "swsh09", "brs")),
    SetInfo("swsh10", "Astral Radiance", "Astral Radiance (TCG)", ("swsh10", "asr")),
    SetInfo("pgo", "Pokémon GO", "Pokémon GO (TCG)", ("pgo",)),
    SetInfo("swsh11", "Lost Origin", "Lost Origin (TCG)", ("swsh11", "lor")),
    SetInfo("swsh12", "Silver Tempest", "Silver Tempest (TCG)", ("swsh12", "sit")),
    SetInfo("swsh12.5", "Crown Zenith", "Crown Zenith (TCG)", ("swsh12.5", "swsh125", "cz", "crz")),

    # Scarlet & Violet
    SetInfo("sv01", "Scarlet & Violet", "Scarlet & Violet (TCG)", ("sv1", "sv01", "svi")),
    SetInfo("sv02", "Paldea Evolved", "Paldea Evolved (TCG)", ("sv2", "sv02", "pal")),
    SetInfo("sv03", "Obsidian Flames", "Obsidian Flames (TCG)", ("sv3", "sv03", "obf")),
    SetInfo("sv03.5", "151", "151 (TCG)", ("sv3.5", "sv03.5", "sv35", "mew")),
    SetInfo("sv04", "Paradox Rift", "Paradox Rift (TCG)", ("sv4", "sv04", "par")),
    SetInfo("sv04.5", "Paldean Fates", "Paldean Fates (TCG)", ("sv4.5", "sv04.5", "sv45", "paf")),
    SetInfo("sv05", "Temporal Forces", "Temporal Forces (TCG)", ("sv5", "sv05", "tef")),
    SetInfo("sv06", "Twilight Masquerade", "Twilight Masquerade (TCG)", ("sv6", "sv06", "twm")),
    SetInfo("sv06.5", "Shrouded Fable", "Shrouded Fable (TCG)", ("sv6.5", "sv06.5", "sv65", "sfa")),
    SetInfo("sv07", "Stellar Crown", "Stellar Crown (TCG)", ("sv7", "sv07", "scr")),
    SetInfo("sv08", "Surging Sparks", "Surging Sparks (TCG)", ("sv8", "sv08", "ssp")),
    SetInfo("sv08.5", "Prismatic Evolutions", "Prismatic Evolutions (TCG)", ("sv8.5", "sv08.5", "sv85", "pre")),
    SetInfo("sv09", "Journey Together", "Journey Together (TCG)", ("sv9", "sv09", "jtg")),
    SetInfo("sv10", "Destined Rivals", "Destined Rivals (TCG)", ("sv10", "dri")),
    SetInfo("zsv10.5", "Black Bolt", "Black Bolt (TCG)", ("zsv10.5", "zsv105", "blk", "blackbolt")),
    SetInfo("rsv10.5", "White Flare", "White Flare (TCG)", ("rsv10.5", "rsv105", "wht", "whiteflare")),

    # Mega Evolution
    SetInfo("me01", "Mega Evolution", "Mega Evolution (TCG)", ("me1", "me01", "meg")),
    SetInfo("me02", "Phantasmal Flames", "Phantasmal Flames (TCG)", ("me2", "me02", "pfl")),
    SetInfo("me02.5", "Ascended Heroes", "Ascended Heroes (TCG)", ("me2.5", "me02.5", "me25", "asc")),
    SetInfo("me03", "Perfect Order", "Perfect Order (TCG)", ("me3", "me03", "por")),
    SetInfo("me04", "Chaos Rising", "Chaos Rising (TCG)", ("me4", "me04", "cri")),
    SetInfo("me05", "Pitch Black", "Pitch Black (TCG)", ("me5", "me05", "pbl")),
    SetInfo("30c", "30th Celebration", "30th Celebration (TCG)", ("30c",)),
    SetInfo("me06", "Delta Reign", "Delta Reign (TCG)", ("me6", "me06", "dlr")),
)


def normalize_code(value: str) -> str:
    value = value.strip().lower()
    value = value.replace("pt", ".")
    return re.sub(r"[^a-z0-9]", "", value)


ALIAS_MAP: dict[str, SetInfo] = {}
for info in SETS:
    values = {info.app_code, *info.aliases}
    for value in values:
        ALIAS_MAP[normalize_code(value)] = info


def request(session: requests.Session, url: str, **kwargs) -> requests.Response:
    last_error: Exception | None = None

    for attempt in range(5):
        try:
            response = session.get(
                url,
                headers=HEADERS,
                timeout=30,
                **kwargs,
            )

            if response.status_code == 429:
                wait = int(response.headers.get("Retry-After", "5"))
                print(f"  429 reçu, attente {wait}s...")
                time.sleep(wait)
                continue

            response.raise_for_status()
            return response

        except requests.RequestException as exc:
            last_error = exc
            if attempt == 4:
                raise
            time.sleep(2 + attempt * 2)

    raise RuntimeError(last_error)


def page_url(page_title: str) -> str:
    return f"{BASE}/wiki/{quote(page_title.replace(' ', '_'), safe='()&_')}"


def gallery_file_titles(session: requests.Session, page_title: str) -> list[str]:
    response = request(session, page_url(page_title))
    soup = BeautifulSoup(response.text, "html.parser")

    gallery_marker = soup.find(id="Gallery")
    if gallery_marker is None:
        # Fallback : cherche un titre contenant Gallery
        gallery_marker = soup.find(
            lambda tag: (
                tag.name in {"h2", "h3", "span"}
                and "gallery" in tag.get_text(" ", strip=True).lower()
            )
        )

    if gallery_marker is None:
        return []

    heading = gallery_marker
    if heading.name not in {"h2", "h3"}:
        heading = gallery_marker.find_parent(["h2", "h3"]) or gallery_marker

    files: list[str] = []
    seen: set[str] = set()

    # Parcourt la section jusqu'au prochain h2.
    for node in heading.find_all_next():
        if node is not heading and node.name == "h2":
            break

        if node.name != "a":
            continue

        href = node.get("href", "")
        title_attr = node.get("title", "")

        file_title = None

        if title_attr.startswith("File:"):
            file_title = title_attr
        elif "/wiki/File:" in href:
            raw = href.split("/wiki/", 1)[1].split("#", 1)[0]
            file_title = unquote(raw).replace("_", " ")

        if file_title and file_title not in seen:
            seen.add(file_title)
            files.append(file_title)

    return files


def score_file_title(file_title: str) -> int:
    name = file_title.lower()
    score = 0

    if "booster" in name:
        score += 100
    if "pack" in name:
        score += 70
    if "wrapper" in name:
        score += 60

    # Évite autant que possible les autres produits.
    penalties = {
        "logo": 120,
        "elite": 80,
        "trainer box": 80,
        "etb": 80,
        "bundle": 60,
        "display": 50,
        "build & battle": 60,
        "blister": 50,
        "sleeve": 60,
        "deck": 60,
        "card": 20,
    }
    for word, penalty in penalties.items():
        if word in name:
            score -= penalty

    return score


def choose_booster_file(files: Iterable[str]) -> str | None:
    files = list(files)
    if not files:
        return None

    scored = [(score_file_title(name), idx, name) for idx, name in enumerate(files)]
    scored.sort(key=lambda item: (-item[0], item[1]))

    best_score, _, best_name = scored[0]

    # Si rien ne ressemble explicitement à un booster/pack,
    # on préfère quand même le premier élément de la Gallery.
    if best_score <= 0:
        return files[0]

    return best_name


def original_file_url(session: requests.Session, file_title: str) -> str:
    response = request(
        session,
        API,
        params={
            "action": "query",
            "format": "json",
            "prop": "imageinfo",
            "iiprop": "url",
            "titles": file_title,
        },
    )
    data = response.json()
    pages = data.get("query", {}).get("pages", {})

    for page in pages.values():
        info = page.get("imageinfo")
        if info:
            return info[0]["url"]

    raise RuntimeError(f"URL originale introuvable pour {file_title}")


def save_as_webp(session: requests.Session, image_url: str, destination: Path) -> None:
    response = request(session, image_url)
    image = Image.open(io.BytesIO(response.content))

    # Préserve la transparence si elle existe.
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        destination,
        format="WEBP",
        quality=92,
        method=6,
    )


def discover_set_code_column(db_path: Path) -> tuple[str, str]:
    preferred_columns = (
        "set_code",
        "product_set",
        "set_id",
        "set",
        "expansion_code",
        "expansion",
    )

    with sqlite3.connect(db_path) as conn:
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        ]

        # Priorise les tables qui ressemblent à une table de cartes.
        tables.sort(key=lambda t: (0 if "card" in t.lower() else 1, t.lower()))

        for table in tables:
            columns = [
                row[1]
                for row in conn.execute(f'PRAGMA table_info("{table}")')
            ]

            lower_to_real = {c.lower(): c for c in columns}

            for candidate in preferred_columns:
                if candidate in lower_to_real:
                    return table, lower_to_real[candidate]

    raise RuntimeError(
        "Impossible de trouver automatiquement une colonne de set code dans la base."
    )


def read_codes_from_db(db_path: Path) -> list[str]:
    table, column = discover_set_code_column(db_path)
    print(f"SQLite : table={table!r}, colonne={column!r}")

    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            f'SELECT DISTINCT "{column}" '
            f'FROM "{table}" '
            f'WHERE "{column}" IS NOT NULL '
            f'AND TRIM(CAST("{column}" AS TEXT)) <> "" '
            f'ORDER BY "{column}"'
        ).fetchall()

    return [str(row[0]).strip() for row in rows]


def resolve_info(code: str) -> SetInfo | None:
    return ALIAS_MAP.get(normalize_code(code))


def default_codes(series: str) -> list[str]:
    if series == "sv":
        return [s.app_code for s in SETS if s.app_code.startswith(("sv", "zsv", "rsv"))]
    if series == "me":
        return [s.app_code for s in SETS if s.app_code.startswith("me") or s.app_code == "30c"]
    if series == "swsh":
        return [
            s.app_code
            for s in SETS
            if s.app_code.startswith("swsh") or s.app_code in {"cel25", "pgo"}
        ]
    return [s.app_code for s in SETS]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="Base pokemon_tcg.sqlite ; les noms de sortie reprendront ses set codes.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("r2-assets-template/ui/boosters/pokemon"),
        help="Dossier de sortie.",
    )
    parser.add_argument(
        "--series",
        choices=("sv", "me", "swsh", "all"),
        default="all",
        help="Utilisé uniquement quand --db n'est pas fourni.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Retélécharge aussi les fichiers déjà présents.",
    )
    args = parser.parse_args()

    if args.db:
        if not args.db.exists():
            print(f"Base introuvable : {args.db}", file=sys.stderr)
            return 2
        codes = read_codes_from_db(args.db)
    else:
        codes = default_codes(args.series)

    print(f"{len(codes)} set(s) à examiner.")
    print(f"Sortie : {args.output.resolve()}")
    print()

    session = requests.Session()
    failures: list[tuple[str, str]] = []

    for index, output_code in enumerate(codes, start=1):
        info = resolve_info(output_code)

        if info is None:
            print(f"[{index}/{len(codes)}] {output_code}: mapping inconnu -> ignoré")
            failures.append((output_code, "mapping inconnu"))
            continue

        destination = args.output / f"{output_code}.webp"

        if destination.exists() and not args.overwrite:
            print(
                f"[{index}/{len(codes)}] {output_code} — {info.name}: "
                "déjà présent -> ignoré"
            )
            continue

        print(f"[{index}/{len(codes)}] {output_code} — {info.name}")

        try:
            files = gallery_file_titles(session, info.bulbapedia_page)
            selected = choose_booster_file(files)

            if not selected:
                raise RuntimeError("aucune image trouvée dans la section Gallery")

            print(f"  image : {selected}")

            url = original_file_url(session, selected)
            save_as_webp(session, url, destination)

            print(f"  OK -> {destination}")

        except Exception as exc:
            print(f"  ERREUR : {exc}")
            failures.append((output_code, str(exc)))

        time.sleep(REQUEST_DELAY_SECONDS)

    print()
    if failures:
        print("Terminé avec erreurs :")
        for code, reason in failures:
            print(f"  - {code}: {reason}")
        return 1

    print("Terminé sans erreur.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
