from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
)

from ..auth import (
    get_current_user_id,
)

from ..models import (
    PassiveCoinsOut,
    WalletOut,
)

from ..services.game_store import (
    claim_passive_income,
    get_wallet_balance,
)


router = APIRouter(
    prefix="/api/wallet",
    tags=["wallet"],
)


@router.get(
    "",
    response_model=WalletOut,
)
def wallet(
    user_id: Annotated[
        str,
        Depends(
            get_current_user_id
        ),
    ],
):
    return WalletOut(
        balance_coins=
            get_wallet_balance(
                user_id
            ),
    )


@router.post(
    "/passive/claim",
    response_model=
        PassiveCoinsOut,
)
def passive_claim(
    user_id: Annotated[
        str,
        Depends(
            get_current_user_id
        ),
    ],
):
    result = (
        claim_passive_income(
            user_id
        )
    )

    return PassiveCoinsOut(
        balance_coins=int(
            result[
                "balance_coins"
            ]
        ),

        earned_coins=int(
            result.get(
                "earned_coins",
                0,
            )
        ),

        ticks=int(
            result.get(
                "ticks",
                0,
            )
        ),

        next_in_seconds=int(
            result.get(
                "next_in_seconds",
                10,
            )
        ),
    )