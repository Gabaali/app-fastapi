from __future__ import annotations

import json
import random
import re
import unicodedata
from datetime import datetime, timezone
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from ..supabase_client import get_supabase_admin


QUIZ_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "lol_quiz_questions_unique_341.json"
)

DAILY_REWARD_LIMIT = 500

# Ces mots apportent peu de sens lorsqu'on compare une réponse libre.
# On les retire uniquement pour le fallback par mots-clés ; les QCM restent
# stricts et les réponses exactes sont toujours testées en premier.
_KEYWORD_STOPWORDS = {
    "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "d", "dans",
    "de", "des", "du", "elle", "elles", "en", "et", "est", "il", "ils",
    "l", "la", "le", "les", "leur", "leurs", "lui", "mais", "ou", "par",
    "parce", "pour", "qu", "que", "qui", "sa", "sans", "se", "ses", "son",
    "sous", "sur", "un", "une", "vers", "à", "été", "etre", "être",
}


@lru_cache(maxsize=1)
def load_quiz_questions() -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    try:
        payload = json.loads(
            QUIZ_DATA_PATH.read_text(encoding="utf-8")
        )
    except Exception as exc:
        raise RuntimeError(
            f"Impossible de charger {QUIZ_DATA_PATH}."
        ) from exc

    questions = payload.get("questions")
    if not isinstance(questions, list):
        raise RuntimeError("Format de quiz invalide: questions manquantes.")

    by_id: dict[str, dict[str, Any]] = {}
    for question in questions:
        question_id = str(question.get("id", "")).strip()
        if not question_id:
            continue
        by_id[question_id] = question

    return payload.get("meta", {}), by_id


def _normalize_answer(value: str) -> str:
    value = value.replace("œ", "oe").replace("Œ", "OE")
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _content_tokens(value: str) -> list[str]:
    return [
        token
        for token in _normalize_answer(value).split()
        if token not in _KEYWORD_STOPWORDS and len(token) >= 2
    ]


def _damerau_levenshtein_distance(left: str, right: str) -> int:
    """Distance d'édition avec transposition adjacente (ex. souers -> soeurs)."""
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)

    rows = len(left) + 1
    cols = len(right) + 1
    matrix = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        matrix[i][0] = i
    for j in range(cols):
        matrix[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if left[i - 1] == right[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            )
            if (
                i > 1
                and j > 1
                and left[i - 1] == right[j - 2]
                and left[i - 2] == right[j - 1]
            ):
                matrix[i][j] = min(matrix[i][j], matrix[i - 2][j - 2] + 1)

    return matrix[-1][-1]


def _keyword_matches_token(keyword: str, token: str) -> bool:
    """Tolérance locale : pluriels, racines explicites et petite faute de frappe."""
    keyword = _normalize_answer(keyword)
    token = _normalize_answer(token)
    if not keyword or not token:
        return False

    if keyword == token:
        return True

    # Singularisation très légère : soeur/soeurs, vastaya/vastayas, etc.
    if len(keyword) >= 4 and len(token) >= 4:
        if keyword.rstrip("sx") == token.rstrip("sx"):
            return True

        # Une petite faute de frappe (y compris une inversion de deux lettres)
        # ne doit pas faire perdre la réponse.
        keyword_base = keyword.rstrip("sx")
        token_base = token.rstrip("sx")
        if _damerau_levenshtein_distance(keyword_base, token_base) <= 1:
            return True
        if SequenceMatcher(None, keyword, token).ratio() >= 0.86:
            return True

    return False


def _keyword_is_present(submitted: str, raw_keyword: str) -> bool:
    """
    Un mot-clé peut être :
    - un mot simple : "soeurs"
    - une racine suffixée par * : "protect*" (protège/protéger/protection...)
    - une petite expression : "rose noire"
    """
    raw_keyword = str(raw_keyword).strip()
    if not raw_keyword:
        return False

    wildcard = raw_keyword.endswith("*")
    keyword = _normalize_answer(raw_keyword[:-1] if wildcard else raw_keyword)
    if not keyword:
        return False

    submitted_tokens = submitted.split()
    keyword_tokens = keyword.split()

    if len(keyword_tokens) > 1:
        # Pour une expression, chaque terme informatif doit être retrouvé.
        return all(
            any(_keyword_matches_token(part, token) for token in submitted_tokens)
            for part in keyword_tokens
        )

    if wildcard:
        # La racine doit rester assez longue pour éviter les faux positifs.
        if len(keyword) < 4:
            return False
        for token in submitted_tokens:
            if token.startswith(keyword):
                return True
            # Tolère également une petite faute dans la racine elle-même.
            comparable = token.rstrip("sx")[: max(len(keyword), 1)]
            if _damerau_levenshtein_distance(keyword.rstrip("sx"), comparable) <= 1:
                return True
        return False

    return any(_keyword_matches_token(keyword, token) for token in submitted_tokens)


def _matches_explicit_keyword_groups(question: dict[str, Any], submitted: str) -> bool:
    groups = question.get("answer_keyword_groups")
    if not isinstance(groups, list) or not groups:
        return False

    # Toutes les familles de sens sont obligatoires ; dans une famille, une seule
    # variante suffit. Exemple : [["ixtal"], ["dirig*", "reine", "trone"]].
    for group in groups:
        if not isinstance(group, list) or not group:
            return False
        if not any(_keyword_is_present(submitted, keyword) for keyword in group):
            return False

    return True


def _matches_automatic_keywords(question: dict[str, Any], submitted: str) -> bool:
    """Fallback conservateur pour les réponses libres non configurées à la main."""
    accepted = question.get("accepted_answers") or [question.get("answer", "")]

    for candidate in accepted:
        tokens = _content_tokens(str(candidate))
        if not tokens:
            continue

        # Les réponses très courtes sont déjà bien gérées par exact/substr/typo.
        # Ici on évite d'accepter un fragment trop vague d'un nom propre composé.
        if len(tokens) == 1:
            required = 1
        elif len(tokens) <= 4:
            required = 2
        else:
            required = 3

        matched = 0
        used_submitted_tokens: set[int] = set()
        submitted_tokens = submitted.split()

        for keyword in tokens:
            for index, token in enumerate(submitted_tokens):
                if index in used_submitted_tokens:
                    continue
                if _keyword_matches_token(keyword, token):
                    matched += 1
                    used_submitted_tokens.add(index)
                    break

        if matched >= min(required, len(tokens)):
            return True

    return False


def _answer_is_correct(question: dict[str, Any], answer: str) -> bool:
    submitted = _normalize_answer(answer)
    if not submitted:
        return False

    accepted = question.get("accepted_answers") or [question.get("answer", "")]
    normalized = {
        _normalize_answer(str(candidate))
        for candidate in accepted
        if str(candidate).strip()
    }

    # QCM : correspondance stricte (après normalisation) pour ne jamais accepter
    # un choix approximatif envoyé manuellement à l'API.
    if question.get("type") == "qcm":
        return submitted in normalized

    # Réponse directe : phrase exacte ou réponse incluse dans une phrase naturelle
    # (ex. "je dirais Nunu" pour la réponse "Nunu").
    if submitted in normalized:
        return True

    for candidate in normalized:
        if len(candidate) >= 4 and re.search(
            rf"(?:^|\s){re.escape(candidate)}(?:$|\s)",
            submitted,
        ):
            return True

    # Règles sémantiques explicites pour les réponses dont plusieurs formulations
    # naturelles sont valides.
    if _matches_explicit_keyword_groups(question, submitted):
        return True

    # Fallback par mots-clés pour les phrases longues : on exige plusieurs termes
    # significatifs afin de rester tolérant sans accepter une réponse hors sujet.
    if _matches_automatic_keywords(question, submitted):
        return True

    # Dernier filet : petite faute de frappe sur une réponse courte/nom propre.
    if len(submitted) >= 5:
        return any(
            len(candidate) >= 5
            and SequenceMatcher(None, submitted, candidate).ratio() >= 0.90
            for candidate in normalized
        )

    return False


def _answered_question_ids(user_id: str) -> set[str]:
    response = (
        get_supabase_admin()
        .table("quiz_attempts")
        .select("question_id")
        .eq("user_id", user_id)
        .execute()
    )

    return {
        str(row["question_id"])
        for row in (response.data or [])
        if row.get("question_id")
    }


def get_random_question(
    *,
    user_id: str,
    difficulty: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    _, by_id = load_quiz_questions()
    answered = _answered_question_ids(user_id)

    candidates = []
    for question in by_id.values():
        if difficulty and question.get("difficulty") != difficulty:
            continue
        if category and question.get("category") != category:
            continue
        if question["id"] in answered:
            continue
        candidates.append(question)

    # Une fois le pool épuisé, on peut continuer à jouer mais les anciennes
    # questions ne pourront plus recréditer de pièces côté SQL.
    exhausted = False
    if not candidates:
        exhausted = True
        candidates = [
            q for q in by_id.values()
            if (not difficulty or q.get("difficulty") == difficulty)
            and (not category or q.get("category") == category)
        ]

    if not candidates:
        raise HTTPException(status_code=404, detail="Aucune question disponible.")

    question = random.SystemRandom().choice(candidates)

    return {
        "id": question["id"],
        "type": question["type"],
        "question": question["question"],
        "choices": question.get("choices"),
        "difficulty": question["difficulty"],
        "reward_coins": int(question["reward_coins"]),
        "category": question["category"],
        "pool_exhausted": exhausted,
    }


def submit_answer(
    *,
    user_id: str,
    question_id: str,
    answer: str,
) -> dict[str, Any]:
    _, by_id = load_quiz_questions()
    question = by_id.get(question_id)

    if not question:
        raise HTTPException(status_code=404, detail="Question introuvable.")

    correct = _answer_is_correct(question, answer)
    reward = int(question["reward_coins"]) if correct else 0

    try:
        response = (
            get_supabase_admin()
            .rpc(
                "record_quiz_answer",
                {
                    "p_user_id": user_id,
                    "p_question_id": question_id,
                    "p_fact_key": question.get("fact_key", question_id),
                    "p_answer_text": answer[:500],
                    "p_correct": correct,
                    "p_reward_coins": reward,
                    "p_daily_reward_limit": DAILY_REWARD_LIMIT,
                },
            )
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur Supabase quiz: {exc}",
        ) from exc

    data = response.data
    if isinstance(data, list) and len(data) == 1:
        data = data[0]
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=500,
            detail="Réponse inattendue de Supabase pour le quiz.",
        )

    return {
        "correct": correct,
        "correct_answer": question["answer"],
        "reward_coins": int(data.get("reward_coins", 0)),
        "balance": int(data.get("balance", 0)),
        "reward_status": str(data.get("reward_status", "none")),
        "daily_rewarded": int(data.get("daily_rewarded", 0)),
        "daily_limit": int(data.get("daily_limit", DAILY_REWARD_LIMIT)),
        "source_label": question.get("source_label"),
        "source_url": question.get("source_url"),
    }


def get_quiz_stats(user_id: str) -> dict[str, Any]:
    start = datetime.now(timezone.utc).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).isoformat()

    attempts_response = (
        get_supabase_admin()
        .table("quiz_attempts")
        .select("question_id,correct,rewarded,reward_coins,created_at")
        .eq("user_id", user_id)
        .gte("created_at", start)
        .execute()
    )

    rows = attempts_response.data or []
    daily_rewarded = sum(1 for row in rows if row.get("rewarded"))
    daily_coins = sum(int(row.get("reward_coins") or 0) for row in rows)
    correct_count = sum(1 for row in rows if row.get("correct"))

    wallet_response = (
        get_supabase_admin()
        .table("wallets")
        .select("balance_coins")
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    balance = int((wallet_response.data or {}).get("balance_coins", 0))

    return {
        "balance": balance,
        "daily_rewarded": daily_rewarded,
        "daily_limit": DAILY_REWARD_LIMIT,
        "daily_coins": daily_coins,
        "daily_attempts": len(rows),
        "daily_correct": correct_count,
    }
