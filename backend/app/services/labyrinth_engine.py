"""Pure expedition rules. Randomness and rewards never come from the client."""
from copy import deepcopy
import random
import uuid

SIZE = 9
ENTRY_COST = 50
MAX_LEVEL = 5
UPGRADES = {
    'luck': ('Chance', '+3 points de chance de trésor, −3 points de piège.'),
    'armor': ('Protection', 'Réduit la perte de butin de 4 points de pourcentage.'),
    'fortune': ('Fortune', '+15 % de pièces dans les trésors.'),
}

class GameError(ValueError):
    pass


def new_state():
    return {'upgrades': {key: 0 for key in UPGRADES}, 'run': None,
            'completed': 0, 'last_event': 'Prêt pour une première expédition ?'}


def upgrade_cost(level):
    return 150 * 2 ** level


def probabilities(state):
    run = state.get('run')
    blessing = 10 if run and run['status'] == 'active' and run['blessing'] > 0 else 0
    bonus = 3 * state['upgrades']['luck'] + blessing
    return {'treasure': 40 + bonus, 'trap': 25 - bonus, 'empty': 20, 'shrine': 15}


def _generate_maze(rng):
    grid = [['wall' for _ in range(SIZE)] for _ in range(SIZE)]
    grid[1][1] = 'path'
    stack = [(1, 1)]
    while stack:
        x, y = stack[-1]
        choices = [(x+dx, y+dy, dx, dy) for dx, dy in ((2,0),(-2,0),(0,2),(0,-2))
                   if 0 < x+dx < SIZE-1 and 0 < y+dy < SIZE-1 and grid[y+dy][x+dx] == 'wall']
        if not choices:
            stack.pop()
            continue
        nx, ny, dx, dy = rng.choice(choices)
        grid[y+dy//2][x+dx//2] = 'path'
        grid[ny][nx] = 'path'
        stack.append((nx, ny))
    grid[1][1] = 'entrance'
    grid[SIZE-2][SIZE-2] = 'exit'
    return grid


def make_maze(rng):
    # A direct route must fit the energy budget; detours still have a cost.
    while True:
        grid = _generate_maze(rng)
        queue = [(1, 1, 0)]
        seen = {(1, 1)}
        for x, y, distance in queue:
            if (x, y) == (SIZE-2, SIZE-2):
                if distance <= 24:
                    return grid
                break
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = x+dx, y+dy
                if 0 <= nx < SIZE and 0 <= ny < SIZE and (nx, ny) not in seen and grid[ny][nx] != 'wall':
                    seen.add((nx, ny))
                    queue.append((nx, ny, distance+1))


def transition(state, action, *, x=None, y=None, upgrade=None, rng=None):
    rng = rng or random.SystemRandom()
    state = deepcopy(state)
    run = state['run']
    active = run and run['status'] == 'active'
    delta = 0
    if action == 'start':
        if active:
            raise GameError('Une expédition est déjà en cours.')
        state['run'] = {'id': str(uuid.uuid4()), 'grid': make_maze(rng), 'x': 1, 'y': 1,
                        'visited': {'1,1': 'entrance'}, 'health': 3, 'energy': 24,
                        'loot': 0, 'blessing': 0, 'status': 'active'}
        delta = -ENTRY_COST
        message = 'Expédition lancée : 50 pièces. Trouve la sortie ou rentre avec ton butin.'
    elif action == 'upgrade':
        if active:
            raise GameError('Les améliorations se font entre deux expéditions.')
        if upgrade not in UPGRADES:
            raise GameError('Amélioration inconnue.')
        level = state['upgrades'][upgrade]
        if level >= MAX_LEVEL:
            raise GameError('Niveau maximal atteint.')
        delta = -upgrade_cost(level)
        state['upgrades'][upgrade] += 1
        message = f'{UPGRADES[upgrade][0]} passe au niveau {level+1}.'
    elif action == 'retreat':
        if not active:
            raise GameError('Aucune expédition en cours.')
        delta = run['loot']
        run['status'] = 'retreated'
        message = f'Retour au camp : {delta} pièces déposées dans ton portefeuille.'
    elif action == 'move':
        if not active:
            raise GameError('Aucune expédition en cours.')
        if x is None or y is None or not (0 <= x < SIZE and 0 <= y < SIZE):
            raise GameError('Tuile invalide.')
        if abs(x-run['x']) + abs(y-run['y']) != 1 or run['grid'][y][x] == 'wall':
            raise GameError('Choisis un passage adjacent à ta position.')
        key = f'{x},{y}'
        if key not in run['visited'] and run['energy'] == 0:
            raise GameError('Plus d’énergie : rentre au camp avec ton butin.')
        run['x'], run['y'] = x, y
        if key in run['visited']:
            message = 'Tu repasses par une tuile explorée. Aucun nouveau tirage.'
        elif run['grid'][y][x] == 'exit':
            run['visited'][key] = 'exit'
            delta = run['loot'] + 150
            run['status'] = 'escaped'
            state['completed'] += 1
            message = f'Sortie trouvée ! {delta} pièces déposées, dont 150 pièces de bonus.'
        else:
            run['energy'] -= 1
            odds = probabilities(state)
            roll = rng.randrange(100)
            event = 'shrine'
            for name in ('treasure', 'trap', 'empty', 'shrine'):
                if roll < odds[name]:
                    event = name
                    break
                roll -= odds[name]
            if run['blessing']:
                run['blessing'] -= 1
            run['visited'][key] = event
            if event == 'treasure':
                gain = rng.randint(25, 70) * (100 + 15*state['upgrades']['fortune']) // 100
                run['loot'] += gain
                message = f'Trésor ! +{gain} pièces dans ton sac.'
            elif event == 'trap':
                lost = run['loot'] * (25 - 4*state['upgrades']['armor']) // 100
                run['loot'] -= lost
                run['health'] -= 1
                message = f'Piège ! −1 cœur et −{lost} pièces dans ton sac.'
                if run['health'] == 0:
                    run['status'] = 'defeated'
                    run['loot'] = 0
                    message += ' Expédition perdue : le butin du sac est perdu.'
            elif event == 'shrine':
                run['blessing'] = 3
                message = 'Sanctuaire : +10 points de chance sur les 3 prochaines tuiles inconnues.'
            else:
                message = 'Un couloir tranquille. Tu avances sans gain ni perte.'
            if run['status'] == 'active' and run['energy'] == 0:
                message += ' Plus d’énergie : utilise « Rentrer au camp ».'
    else:
        raise GameError('Action inconnue.')
    state['last_event'] = message
    return state, delta


def public_state(state, version, balance):
    result = deepcopy(state)
    result.update(version=version, balance_coins=balance, entry_cost=ENTRY_COST,
                  probabilities=probabilities(state),
                  upgrade_options=[{'key': key, 'name': name, 'description': desc,
                                    'level': state['upgrades'][key], 'max_level': MAX_LEVEL,
                                    'cost': upgrade_cost(state['upgrades'][key])}
                                   for key, (name, desc) in UPGRADES.items()])
    run = result.get('run')
    if run:
        grid = run.pop('grid')
        run['tiles'] = []
        for y in range(SIZE):
            for x in range(SIZE):
                key = f'{x},{y}'
                visited = key in run['visited']
                near_visited = any(f'{x+dx},{y+dy}' in run['visited']
                                   for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
                visible = visited or near_visited
                kind = run['visited'].get(key) if visited else (grid[y][x] if visible else 'unknown')
                run['tiles'].append({'x': x, 'y': y, 'kind': kind, 'visited': visited,
                                     'reachable': run['status'] == 'active' and visible
                                     and grid[y][x] != 'wall' and abs(x-run['x'])+abs(y-run['y']) == 1
                                     and (visited or run['energy'] > 0)})
        del run['visited']
    return result
