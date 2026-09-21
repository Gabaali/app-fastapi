from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user_id
from ..models import Game, SetSummary
from ..services.card_catalog import list_sets


router = APIRouter(
    prefix="/api/catalog",
    tags=["catalog"],
)


@router.get("/{game}/sets", response_model=list[SetSummary])
def get_sets(
    game: Game,
    _: Annotated[str, Depends(get_current_user_id)],
):
    try:
        return list_sets(game)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
