Structure attendue :

backend/data/
├── onepiece_cards.sqlite
├── pokemon_tcg.sqlite
├── riftbound_tcg.sqlite
├── optc_images/
├── pokemon_images/
└── riftbound_images/

Mapping :

- ancien `images\...` One Piece -> `optc_images/...`
- `pokemon_images\...` -> `pokemon_images/...`
- `riftbound_images\...` -> `riftbound_images/...`

FastAPI sert ensuite :

- `/media/onepiece/...`
- `/media/pokemon/...`
- `/media/riftbound/...`
