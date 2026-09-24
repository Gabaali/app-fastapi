from typing import Literal

from pydantic import BaseModel, Field


Game = Literal["onepiece", "pokemon", "riftbound", "flags"]


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
    metadata: dict[str, str] | None = None


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

class PassiveCoinsOut(BaseModel):
    balance_coins: int
    earned_coins: int
    ticks: int
    next_in_seconds: int
class QuizQuestionOut(BaseModel):
    id: str
    type: Literal["qcm", "direct"]
    question: str
    choices: list[str] | None = None
    difficulty: Literal["easy", "medium", "hard"]
    reward_coins: int
    category: Literal["champions", "monde"]
    pool_exhausted: bool = False


class QuizAnswerRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=64)
    answer: str = Field(min_length=1, max_length=500)


class QuizAnswerResponse(BaseModel):
    correct: bool
    correct_answer: str
    reward_coins: int
    balance: int
    reward_status: Literal[
        "awarded",
        "already_rewarded",
        "already_attempted",
        "daily_limit",
        "wrong",
        "none",
    ]
    daily_rewarded: int
    daily_limit: int
    source_label: str | None = None
    source_url: str | None = None


class QuizStatsOut(BaseModel):
    balance: int
    daily_rewarded: int
    daily_limit: int
    daily_coins: int
    daily_attempts: int
    daily_correct: int
