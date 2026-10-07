import random
import unittest
from app.services.labyrinth_engine import GameError, make_maze, new_state, probabilities, public_state, transition

class FixedRandom:
    def __init__(self, roll): self.roll = roll
    def randrange(self, _): return self.roll
    def randint(self, a, b): return a

def fixture():
    state = new_state()
    grid = [['wall'] * 9 for _ in range(9)]
    grid[1][1:5] = ['entrance', 'path', 'path', 'exit']
    state['run'] = {'id': 'test', 'grid': grid, 'visited': {'1,1': 'entrance'}, 'x': 1, 'y': 1,
                    'health': 3, 'energy': 24, 'loot': 100, 'blessing': 0, 'status': 'active'}
    return state

class LabyrinthTests(unittest.TestCase):
    def test_maze_connected_exit_reachable_in_budget(self):
        for seed in range(100):
            grid = make_maze(random.Random(seed))
            queue = [(1, 1, 0)]
            seen = {(1, 1)}
            for x, y, d in queue:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < 9 and 0 <= ny < 9 and grid[ny][nx] != 'wall' and (nx, ny) not in seen:
                        seen.add((nx, ny)); queue.append((nx, ny, d+1))
            self.assertEqual(len(seen), 31)
            self.assertLessEqual(next(d for x,y,d in queue if (x,y) == (7,7)), 24)

    def test_probabilities_and_upgrade_caps(self):
        state = fixture()
        for level in range(6):
            state['upgrades']['luck'] = level
            for blessing in (0, 3):
                state['run']['blessing'] = blessing
                odds = probabilities(state)
                self.assertEqual(sum(odds.values()), 100)
                self.assertGreaterEqual(min(odds.values()), 0)
        state['run'] = None
        with self.assertRaises(GameError): transition(state, 'upgrade', upgrade='luck')

    def test_treasure_does_not_credit_wallet_and_revisit_never_pays(self):
        before = fixture()
        state, delta = transition(before, 'move', x=2, y=1, rng=FixedRandom(0))
        self.assertEqual(delta, 0)
        self.assertEqual(state['run']['loot'], 125)
        self.assertEqual(before['run']['loot'], 100)
        state, _ = transition(state, 'move', x=1, y=1)
        state, delta = transition(state, 'move', x=2, y=1, rng=FixedRandom(0))
        self.assertEqual((state['run']['loot'], state['run']['energy'], delta), (125, 23, 0))

    def test_trap_protection_and_defeat(self):
        state = fixture(); state['upgrades']['armor'] = 5
        state, _ = transition(state, 'move', x=2, y=1, rng=FixedRandom(40))
        self.assertEqual((state['run']['health'], state['run']['loot']), (2, 95))
        state = fixture(); state['run']['health'] = 1
        state, delta = transition(state, 'move', x=2, y=1, rng=FixedRandom(40))
        self.assertEqual((state['run']['status'], state['run']['loot'], delta), ('defeated', 0, 0))
        with self.assertRaises(GameError): transition(state, 'retreat')

    def test_retreat_and_exit_cannot_pay_twice(self):
        state, delta = transition(fixture(), 'retreat')
        self.assertEqual(delta, 100)
        with self.assertRaises(GameError): transition(state, 'retreat')
        state = fixture(); state['run']['x'] = 3
        state, delta = transition(state, 'move', x=4, y=1)
        self.assertEqual((delta, state['completed']), (250, 1))
        with self.assertRaises(GameError): transition(state, 'move', x=3, y=1)

    def test_blessing_three_new_tiles_only(self):
        state, _ = transition(fixture(), 'move', x=2, y=1, rng=FixedRandom(99))
        self.assertEqual(probabilities(state)['treasure'], 50)
        state, _ = transition(state, 'move', x=1, y=1)
        self.assertEqual(state['run']['blessing'], 3)
        state, _ = transition(state, 'move', x=2, y=1)
        state, _ = transition(state, 'move', x=3, y=1, rng=FixedRandom(0))
        self.assertEqual(state['run']['blessing'], 2)
        state, _ = transition(state, 'retreat')
        self.assertEqual(probabilities(state)['treasure'], 40)

    def test_invalid_moves_and_energy_exhaustion(self):
        for x,y in ((3,1), (1,0), (-1,1), (1,1)):
            with self.assertRaises(GameError): transition(fixture(), 'move', x=x, y=y)
        state = fixture(); state['run']['energy'] = 0
        with self.assertRaises(GameError): transition(state, 'move', x=2, y=1)
        state, delta = transition(state, 'retreat')
        self.assertEqual(delta, 100)

    def test_fog_does_not_disclose_remote_walls_or_events(self):
        original = fixture()
        view = public_state(original, 0, 500)
        self.assertNotIn('grid', view['run'])
        self.assertNotIn('visited', view['run'])
        self.assertIn('grid', original['run'])
        tile = next(t for t in view['run']['tiles'] if (t['x'],t['y']) == (4,1))
        self.assertEqual(tile['kind'], 'unknown')
        self.assertFalse(tile['reachable'])

    def test_upgrades_cost_and_fortune(self):
        state = new_state()
        state, delta = transition(state, 'upgrade', upgrade='fortune')
        self.assertEqual((delta, state['upgrades']['fortune']), (-150, 1))
        state, delta = transition(state, 'upgrade', upgrade='fortune')
        self.assertEqual(delta, -300)
        state = fixture(); state['upgrades']['fortune'] = 2
        state, _ = transition(state, 'move', x=2, y=1, rng=FixedRandom(0))
        self.assertEqual(state['run']['loot'], 132)
        with self.assertRaises(GameError): transition(state, 'upgrade', upgrade='armor')

    def test_start_charges_once_and_preserves_progress(self):
        state = new_state(); state['upgrades']['luck'] = 2
        state, delta = transition(state, 'start', rng=random.Random(1))
        self.assertEqual(delta, -50)
        self.assertEqual(state['upgrades']['luck'], 2)
        with self.assertRaises(GameError): transition(state, 'start')

if __name__ == '__main__': unittest.main()
