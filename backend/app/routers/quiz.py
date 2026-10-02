from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user_id
from ..models import (
    QuizAnswerRequest,
    QuizAnswerResponse,
    QuizQuestionOut,
    QuizStatsOut,
)
from ..services.quiz_store import (
    get_quiz_stats,
    get_quiz_domains,
    get_random_question,
    submit_answer,
)


router = APIRouter(
    prefix="/api/quiz",
    tags=["quiz"],
)


@router.get("/question", response_model=QuizQuestionOut)
def question(
    user_id: Annotated[str, Depends(get_current_user_id)],
    difficulty: Annotated[
        Literal["easy", "medium", "hard"] | None,
        Query(),
    ] = None,
    category: Annotated[
        Literal["champions", "monde", "films", "culture_generale"] | None,
        Query(),
    ] = None,
    excluded_domains: Annotated[list[str] | None, Query()] = None,
    theme: Annotated[Literal["lol", "cinema", "culture_generale"], Query()] = "lol",
):
    return get_random_question(
        user_id=user_id,
        difficulty=difficulty,
        category=category,
        theme=theme,
        excluded_domains=excluded_domains,
    )


@router.post("/answer", response_model=QuizAnswerResponse)
def answer(
    payload: QuizAnswerRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    return submit_answer(
        user_id=user_id,
        question_id=payload.question_id,
        answer=payload.answer,
    )


@router.get("/stats", response_model=QuizStatsOut)
def stats(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    return get_quiz_stats(user_id)


@router.get("/domains")
def domains(user_id: Annotated[str, Depends(get_current_user_id)]):
    return get_quiz_domains()
