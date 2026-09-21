from typing import Annotated

from fastapi import APIRouter, Depends

from ..auth import get_current_user_id
from ..models import WalletOut
from ..services.game_store import get_wallet_balance


router = APIRouter(
    prefix="/api/wallet",
    tags=["wallet"],
)


@router.get("", response_model=WalletOut)
def wallet(
    user_id: Annotated[str, Depends(get_current_user_id)],
):
    return WalletOut(
        balance_coins=get_wallet_balance(user_id),
    )
