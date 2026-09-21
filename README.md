# TCG Web Starter — Next.js + FastAPI + Supabase + SQLite

Architecture de départ pour reconstruire l'application TCG sans Streamlit.

## Architecture

- **Next.js / React** : interface, animations et navigation instantanée.
- **Supabase Auth** : inscription / connexion.
- **FastAPI** : logique métier et validation serveur.
- **SQLite local au backend** : catalogues statiques de cartes.
- **Supabase PostgreSQL** : wallet, collection et ouvertures.

Les SQLite ne sont jamais accessibles directement depuis le navigateur.

## Prérequis

- Python 3.11+
- Node.js 22+
- Un projet Supabase neuf
- Tes fichiers :
  - `onepiece_cards.sqlite`
  - `pokemon_tcg.sqlite`
  - `riftbound_tcg.sqlite`

## 1. Supabase

Dans le dashboard Supabase :

1. Crée un projet.
2. Ouvre **SQL Editor**.
3. Exécute `supabase/schema.sql`.
4. Active Email/Password dans Authentication.
5. Récupère :
   - Project URL
   - Publishable key
   - Secret key

Le **Secret key ne doit jamais être mis dans Next.js**.

## 2. Backend

Copie tes trois SQLite dans `backend/data/`.

```bash
cd backend
python -m venv .venv

# Linux/macOS
source .venv/bin/activate

# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Teste ensuite :

- http://localhost:8000/health
- http://localhost:8000/docs

## 3. Frontend

Dans un second terminal :

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Puis ouvre :

- http://localhost:3000/login
- http://localhost:3000/booster

## Simulateur de booster

Le starter contient un simulateur simple dans :

`backend/app/services/booster_simulator.py`

C'est volontaire : tu peux ensuite y porter exactement les probabilités One Piece,
Pokémon et Riftbound de ton ancienne application sans toucher au frontend.

Flux :

`SQLite -> simulateur -> FastAPI -> transaction Supabase -> JSON -> React`

## Pourquoi l'ouverture sera fluide

Un clic envoie une seule requête `POST /api/boosters/open`.
La page React reste en mémoire pendant toute l'opération.

FastAPI génère le booster depuis le SQLite local puis appelle une seule fonction
PostgreSQL qui débite le wallet, enregistre l'ouverture et met à jour la collection
dans la même transaction.


## Mapping des images — version 2

Garde exactement cette structure :

```text
backend/
└── data/
    ├── onepiece_cards.sqlite
    ├── pokemon_tcg.sqlite
    ├── riftbound_tcg.sqlite
    │
    ├── optc_images/
    │   ├── 569001/
    │   │   ├── ST01-001.png
    │   │   └── ...
    │   ├── 569002/
    │   └── ...
    │
    ├── pokemon_images/
    │   ├── base1/
    │   │   ├── base1-1.webp
    │   │   └── ...
    │   └── ...
    │
    └── riftbound_images/
        ├── OGN/
        │   ├── OGN-001_298.png
        │   └── ...
        ├── SFD/
        └── ...
```

Les anciens chemins SQLite sont convertis automatiquement :

```text
images\569001\ST01-001.png
-> backend/data/optc_images/569001/ST01-001.png
-> http://localhost:8000/media/onepiece/569001/ST01-001.png
```

```text
pokemon_images\base1\base1-1.webp
-> backend/data/pokemon_images/base1/base1-1.webp
-> http://localhost:8000/media/pokemon/base1/base1-1.webp
```

```text
riftbound_images\OGN\OGN-001_298.png
-> backend/data/riftbound_images/OGN/OGN-001_298.png
-> http://localhost:8000/media/riftbound/OGN/OGN-001_298.png
```

Pour One Piece, le mapper conserve également la logique des variantes de
l'ancienne application : overrides exacts, cartes normales et prints parallèles.

Test rapide après lancement :

```text
http://localhost:8000/health/media
```

En production, règle :

```env
PUBLIC_API_URL=https://ton-api.example.com
```

Les URLs retournées par FastAPI pointeront alors automatiquement vers le
serveur public.
