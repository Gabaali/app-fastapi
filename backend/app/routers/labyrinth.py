from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..auth import get_current_user_id
from ..supabase_client import get_supabase_admin
from ..services.labyrinth_engine import GameError, new_state, public_state, transition

router = APIRouter(prefix='/api/labyrinth', tags=['labyrinth'])
User = Annotated[str, Depends(get_current_user_id)]

class ActionRequest(BaseModel):
    action: Literal['start', 'move', 'retreat', 'upgrade']
    expected_version: int = Field(ge=0)
    x: int | None = Field(default=None, ge=0, le=8)
    y: int | None = Field(default=None, ge=0, le=8)
    upgrade: Literal['luck', 'armor', 'fortune'] | None = None


def rpc(name, params):
    try:
        data = get_supabase_admin().rpc(name, params).execute().data
    except Exception as exc:
        for code, message in [('STALE_STATE', 'La partie a changé. Actualise avant de rejouer.'),
                              ('INSUFFICIENT_FUNDS', 'Solde insuffisant.'),
                              ('WALLET_NOT_FOUND', 'Portefeuille introuvable.')]:
            if code in str(exc):
                raise HTTPException(status_code=409, detail=message) from exc
        raise HTTPException(status_code=503, detail='Labyrinthe indisponible. Vérifie la migration Supabase et la connexion du serveur.') from exc
    if isinstance(data, list) and len(data) == 1:
        data = data[0]
    if not isinstance(data, dict):
        raise HTTPException(status_code=503, detail='Réponse du labyrinthe invalide.')
    return data


def snapshot(user_id):
    return rpc('labyrinth_snapshot', {'p_user_id': user_id, 'p_initial_state': new_state()})


@router.get('')
def get_state(user_id: User):
    data = snapshot(user_id)
    return public_state(data['state'], data['version'], data['balance_coins'])


@router.post('/action')
def perform_action(payload: ActionRequest, user_id: User):
    data = snapshot(user_id)
    if data['version'] != payload.expected_version:
        raise HTTPException(status_code=409, detail='La partie a changé. Actualise avant de rejouer.')
    try:
        state, delta = transition(data['state'], payload.action, x=payload.x, y=payload.y, upgrade=payload.upgrade)
    except GameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    saved = rpc('labyrinth_commit', {'p_user_id': user_id, 'p_expected_version': payload.expected_version,
                                     'p_state': state, 'p_delta': delta})
    return public_state(saved['state'], saved['version'], saved['balance_coins'])
