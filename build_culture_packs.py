#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Génère un quiz de culture générale en français, compatible avec le format
des quiz utilisés dans l'application.

Source principale :
  OpenTriviaQA-FR
  https://github.com/viorizz/OpenTriviaQA-FR
  Licence : CC BY-SA 4.0

Usage :
  python build_culture_generale_quiz.py
  python build_culture_generale_quiz.py --count 3000
  python build_culture_generale_quiz.py --count 5000 --output culture_generale_quiz_5000.json

Le script télécharge automatiquement le dépôt GitHub, extrait les questions,
les normalise, déduplique et crée le JSON final.
"""

import argparse
import hashlib
import html
import io
import json
import random
import re
import sys
import unicodedata
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

REPO_ZIP = "https://github.com/viorizz/OpenTriviaQA-FR/archive/refs/heads/master.zip"
SOURCE_LABEL = "OpenTriviaQA-FR"
SOURCE_URL = "https://github.com/viorizz/OpenTriviaQA-FR"
LICENSE = "CC BY-SA 4.0"

CATEGORY_MAP = {
    "animals": "animaux",
    "brain-teasers": "logique",
    "celebrities": "celebrites",
    "entertainment": "divertissement",
    "for-kids": "jeunesse",
    "general": "culture_generale",
    "geography": "geographie",
    "history": "histoire",
    "humanities": "sciences_humaines",
    "literature": "litterature",
    "movies": "cinema",
    "music": "musique",
    "newest": "culture_generale",
    "people": "personnalites",
    "religion-faith": "religions",
    "science-technology": "sciences",
    "sports": "sport",
    "television": "television",
    "video-games": "jeux_video",
    "world": "monde",
}

FR_LABELS = {
    "animaux": "Animaux",
    "logique": "Logique",
    "celebrites": "Célébrités",
    "divertissement": "Divertissement",
    "jeunesse": "Jeunesse",
    "culture_generale": "Culture générale",
    "geographie": "Géographie",
    "histoire": "Histoire",
    "sciences_humaines": "Sciences humaines",
    "litterature": "Littérature",
    "cinema": "Cinéma",
    "musique": "Musique",
    "personnalites": "Personnalités",
    "religions": "Religions",
    "sciences": "Sciences et technologie",
    "sport": "Sport",
    "television": "Télévision",
    "jeux_video": "Jeux vidéo",
    "monde": "Monde",
}

def clean_text(s: str) -> str:
    s = html.unescape(s or "")
    s = s.replace("\u00a0", " ")
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def norm_key(s: str) -> str:
    s = clean_text(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def slug(s: str) -> str:
    return norm_key(s).replace(" ", "-")[:80]

def difficulty_for(question: str, choices: list[str]) -> str:
    """
    OpenTriviaQA-FR n'inclut pas de difficulté native.
    On utilise donc un heuristic transparent et reproductible :
      easy   : question courte / réponse généralement concise
      medium : cas standard
      hard   : question longue, nombreuses propositions ou vocabulaire complexe
    """
    qlen = len(question)
    avg_choice = sum(len(x) for x in choices) / max(1, len(choices))
    if qlen <= 70 and avg_choice <= 24:
        return "easy"
    if qlen >= 145 or avg_choice >= 48 or len(choices) >= 5:
        return "hard"
    return "medium"

def reward(diff: str) -> int:
    return {"easy": 10, "medium": 15, "hard": 25}[diff]

def download_zip() -> bytes:
    req = urllib.request.Request(
        REPO_ZIP,
        headers={"User-Agent": "Mozilla/5.0 quiz-dataset-builder/1.0"}
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()

def parse_question_blocks(text: str, category_slug: str):
    """
    Format OpenTriviaQA :
      #Q question
      ^ réponse correcte
      A distracteur
      B distracteur
      ...
    """
    current_q = None
    correct = None
    distractors = []

    def emit():
        nonlocal current_q, correct, distractors
        if not current_q or not correct:
            return None

        q = clean_text(current_q)
        answer = clean_text(correct)
        wrong = []
        seen = {norm_key(answer)}

        for d in distractors:
            d = clean_text(d)
            k = norm_key(d)
            if d and k and k not in seen:
                wrong.append(d)
                seen.add(k)

        # Il faut au moins 3 mauvaises réponses pour un QCM de 4 choix.
        if len(wrong) < 3:
            return None

        # On garde 3 distracteurs afin d'avoir exactement 4 choix.
        wrong = wrong[:3]
        choices = [answer] + wrong

        return {
            "question": q,
            "answer": answer,
            "choices": choices,
            "category": CATEGORY_MAP.get(category_slug, category_slug),
        }

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if line.startswith("#Q"):
            item = emit()
            if item:
                yield item
            current_q = line[2:].strip()
            correct = None
            distractors = []
        elif line.startswith("^"):
            correct = line[1:].strip()
        elif re.match(r"^[A-Z]\s+", line):
            distractors.append(line[1:].strip())

    item = emit()
    if item:
        yield item

def find_category_files(zf: zipfile.ZipFile):
    files = []
    for name in zf.namelist():
        low = name.lower()
        if "/categories/" not in low:
            continue
        if low.endswith("/"):
            continue
        # Le repo utilise surtout des fichiers texte, parfois sans extension standard.
        if any(part in low for part in ("/readme", "/license")):
            continue
        files.append(name)
    return files

def category_from_filename(name: str) -> str:
    base = Path(name).stem.lower()
    base = re.sub(r"[^a-z0-9-]+", "-", base).strip("-")
    return base

def build(count: int, seed: int):
    data = download_zip()
    zf = zipfile.ZipFile(io.BytesIO(data))

    raw_items = []
    for filename in find_category_files(zf):
        category_slug = category_from_filename(filename)
        try:
            text = zf.read(filename).decode("utf-8", errors="replace")
        except Exception:
            continue
        raw_items.extend(parse_question_blocks(text, category_slug))

    # Déduplication stricte par formulation normalisée.
    dedup = {}
    for x in raw_items:
        qk = norm_key(x["question"])
        if len(qk) < 8:
            continue
        if qk not in dedup:
            dedup[qk] = x

    items = list(dedup.values())

    # Filtrages qualité simples.
    cleaned = []
    for x in items:
        q = x["question"]
        ans = x["answer"]
        choices = x["choices"]

        if len(q) < 12 or len(q) > 500:
            continue
        if not ans or len(ans) > 180:
            continue
        if len({norm_key(c) for c in choices}) != 4:
            continue

        cleaned.append(x)

    rng = random.Random(seed)

    # Équilibrage grossier par catégorie pour éviter qu'une seule catégorie domine.
    by_cat = {}
    for x in cleaned:
        by_cat.setdefault(x["category"], []).append(x)
    for arr in by_cat.values():
        rng.shuffle(arr)

    selected = []
    cats = sorted(by_cat)

    # Round robin pour maximiser la variété.
    i = 0
    while len(selected) < count:
        added = False
        for cat in cats:
            arr = by_cat[cat]
            if i < len(arr):
                selected.append(arr[i])
                added = True
                if len(selected) >= count:
                    break
        if not added:
            break
        i += 1

    rng.shuffle(selected)

    questions = []
    for idx, x in enumerate(selected, 1):
        choices = list(x["choices"])
        rng.shuffle(choices)

        diff = difficulty_for(x["question"], choices)
        cat = x["category"]
        key_hash = hashlib.sha1(
            (norm_key(x["question"]) + "|" + norm_key(x["answer"])).encode("utf-8")
        ).hexdigest()[:14]

        questions.append({
            "id": f"culture-{idx:05d}",
            "fact_key": f"trivia:{key_hash}",
            "type": "qcm",
            "question": x["question"],
            "answer": x["answer"],
            "accepted_answers": [x["answer"]],
            "difficulty": diff,
            "reward_coins": reward(diff),
            "category": "culture_generale",
            "domain": cat,
            "domain_label": FR_LABELS.get(cat, cat.replace("_", " ").title()),
            "source_label": SOURCE_LABEL,
            "source_url": SOURCE_URL,
            "source_license": LICENSE,
            "language": "fr",
            "choices": choices,
        })

    stats_diff = Counter(q["difficulty"] for q in questions)
    stats_domain = Counter(q["domain"] for q in questions)

    payload = {
        "meta": {
            "schema_version": 3,
            "generated_language": "fr",
            "question_count": len(questions),
            "qcm_count": len(questions),
            "direct_count": 0,
            "requested_count": count,
            "deduplication": "stricte sur la question normalisée",
            "source": SOURCE_LABEL,
            "source_url": SOURCE_URL,
            "source_license": LICENSE,
            "difficulty_note": (
                "La source ne fournit pas de niveau de difficulté. "
                "Les niveaux easy/medium/hard sont estimés automatiquement "
                "à partir de la longueur et de la complexité apparente."
            ),
            "difficulty_distribution": dict(stats_diff),
            "domain_distribution": dict(stats_domain),
            "matching": "QCM strict ; réponse correcte présente dans choices",
        },
        "questions": questions,
    }
    return payload

def validate(payload):
    qs = payload["questions"]
    ids = [q["id"] for q in qs]
    fks = [q["fact_key"] for q in qs]

    assert len(ids) == len(set(ids)), "IDs dupliqués"
    assert len(fks) == len(set(fks)), "fact_key dupliqués"

    for q in qs:
        assert q["type"] == "qcm"
        assert len(q["choices"]) == 4
        assert q["answer"] in q["choices"]
        assert len(set(norm_key(x) for x in q["choices"])) == 4

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=3000)
    p.add_argument("--output", default="culture_generale_quiz_3000.json")
    p.add_argument("--seed", type=int, default=20261002)
    args = p.parse_args()

    print("Téléchargement et analyse d'OpenTriviaQA-FR...")
    payload = build(args.count, args.seed)
    validate(payload)

    out = Path(args.output)
    out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Questions générées : {payload['meta']['question_count']}")
    print(f"Fichier : {out.resolve()}")
    print("Répartition difficulté :", payload["meta"]["difficulty_distribution"])
    print("Répartition domaines :", payload["meta"]["domain_distribution"])

    if payload["meta"]["question_count"] < args.count:
        print(
            f"ATTENTION : seulement {payload['meta']['question_count']} questions "
            f"valides disponibles après nettoyage (demandé : {args.count})."
        )

if __name__ == "__main__":
    main()
