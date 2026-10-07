# Mode Labyrinthe

## Installation

1. Utiliser ce projet mis à jour, avec la configuration Supabase et API habituelle.
2. Dans l'éditeur SQL de ton projet Supabase, exécuter **une fois** le fichier
   `supabase/migrations/20261007_labyrinth.sql`.
   Le schéma d'origine de l'application doit déjà être installé : la migration
   utilise `wallets` et `wallet_transactions` sans les recréer.
3. Redémarrer FastAPI depuis `backend` :
   ```bash
   uvicorn app.main:app --reload
   ```
4. Lancer le frontend depuis `frontend` :
   ```bash
   npm install
   npm run dev
   ```
5. Se connecter avec un compte existant, puis cliquer sur **Labyrinthe** depuis
   les boosters, ou ouvrir `http://localhost:3000/labyrinthe`.

La migration ne dépense aucune pièce. Les frais sont prélevés quand le joueur
lance une expédition ou achète une amélioration. Les fonctions SQL sont réservées
au client admin du backend ; conserver la clé secrète uniquement côté serveur.

## Boucle de jeu

- Labyrinthe aléatoire de 9 × 9, avec murs, passages, entrée et sortie.
- Exploration en cliquant sur un passage adjacent ; carte dévoilée progressivement.
- Départ : **50 pièces**, **3 cœurs**, **24 points d'énergie**.
- Une nouvelle tuile ordinaire consomme une énergie et déclenche un tirage.
  Repasser sur une tuile ne coûte rien et ne rapporte rien.
- La génération garantit un chemin direct vers la sortie d'au plus 24 pas.
  Les détours peuvent épuiser l'énergie : rentrer au camp reste possible.
- Le butin est dans un sac séparé du portefeuille. Rentrer au camp à tout moment
  dépose le sac dans le portefeuille et termine l'expédition.
- Trouver la sortie dépose le sac et **150 pièces supplémentaires**.
- À zéro cœur, l'expédition se termine et le sac est perdu. Aucun prélèvement
  supplémentaire n'est effectué sur le portefeuille.
- Fermer ou actualiser la page conserve l'expédition et les améliorations.

## Probabilités initiales

| Événement | Probabilité | Effet |
| --- | --- | --- |
| Trésor | 40 % | Entre 25 et 70 pièces dans le sac, avant Fortune |
| Piège | 25 % | −1 cœur et perte de 25 % du sac, avant Protection |
| Couloir | 20 % | Aucun gain ni perte |
| Sanctuaire | 15 % | Pendant 3 nouvelles tuiles : +10 points de trésor, −10 points de piège |

Ces tirages ne concernent pas l'entrée, la sortie ou les tuiles déjà explorées.
La bénédiction se renouvelle à trois tuiles en trouvant un autre sanctuaire.
Les pourcentages sont affichés avant le prochain pas et totalisent toujours 100 %.

## Améliorations permanentes

Disponibles entre deux expéditions. Chaque amélioration a cinq niveaux.
Prix successifs : **150, 300, 600, 1 200 et 2 400 pièces**.

| Amélioration | Effet par niveau |
| --- | --- |
| Chance | +3 points de trésor, −3 points de piège |
| Protection | −4 points sur le pourcentage du sac perdu par un piège (minimum 5 % au niveau 5) |
| Fortune | +15 % de pièces sur les trésors (jusqu'à +75 %) |

Protection réduit la perte de pièces, pas la perte du cœur. Les calculs de pièces
sont arrondis à l'entier inférieur. Ces chiffres constituent un premier équilibrage
à ajuster après des parties réelles.

## Implémentation

- `frontend/app/labyrinthe/` : écran français, clavier via les boutons, mise en page responsive.
- `backend/app/services/labyrinth_engine.py` : génération, événements et règles pures.
- `backend/app/routers/labyrinth.py` : API authentifiée `/api/labyrinth` et `/api/labyrinth/action`.
- `supabase/migrations/20261007_labyrinth.sql` : état par joueur, version et transactions atomiques.
- `backend/tests/test_labyrinth.py` : tests de génération, probabilités, événements et récompenses.

Le serveur choisit les événements avec `SystemRandom`. Les pièces, la carte et les
niveaux ne sont pas acceptés depuis le navigateur. Le frontend envoie la version
courante : un doublon ou une action depuis un onglet périmé est refusé. Le verrou
SQL du portefeuille protège aussi les achats concurrents de boosters. Chaque
échange de pièces est inscrit dans `wallet_transactions`.

Pour modifier l'équilibrage, changer les règles dans `labyrinth_engine.py` et les
textes/chiffres correspondants dans la page du frontend. Les règles SQL ne
contiennent pas les probabilités. Une expédition existante garde sa carte et son
énergie enregistrées.

## Vérifications

Depuis `backend` :
```bash
python -m unittest discover -s tests -v
```
Depuis `frontend` :
```bash
npx tsc --noEmit --incremental false
```

Résultat dans l'environnement de préparation : **10 tests de logique réussis**,
avec 100 labyrinthes vérifiés, et **vérification TypeScript réussie**.
La vérification visuelle, le build Next.js complet et l'intégration avec un projet
Supabase actif n'ont pas pu être réalisés dans cet environnement. Après la
migration, vérifier le départ (−50), le retour (crédit du sac), l'amélioration,
la reprise après actualisation et l'action depuis deux onglets : seule une action
sur une même version doit être acceptée.
