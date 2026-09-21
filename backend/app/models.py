from typing import Literal

from pydantic import BaseModel, Field


Game = Literal["onepiece", "pokemon", "riftbound"]


class SetSummary(BaseModel):
    set_code: str
    set_name: str
    card_count: int | None = None


class CardOut(BaseModel):
    card_key: str
    game: Game
    product_set: str
    card_number: str = ""
    name: str
    rarity: str = ""
    variant: str = ""
    drop_class: str = ""
    image_url: str | None = None
    collectible: bool = True
    slot: str | None = None
    is_new: bool = False


class BoosterOpenRequest(BaseModel):
    game: Game
    set_code: str = Field(min_length=1, max_length=64)


class BoosterOpenResponse(BaseModel):
    opening_id: int
    balance: int
    price_coins: int
    cards: list[CardOut]


class WalletOut(BaseModel):
    balance_coins: int
