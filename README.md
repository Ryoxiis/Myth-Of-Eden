# Myth of Eden

Jeu solo médiéval fantastique en 3D, à la troisième personne. Le joueur choisit une classe et explore un monde mystérieux pour retrouver son ancien compagnon disparu, lié à une légende et au passé du personnage.

Pour le contexte complet (histoire, classes, prototype, questions ouvertes), voir [la fiche de contexte](contexte-projet-jeu.md).

## Rôle de Symfony

Symfony gère les comptes, les parties, les personnages, les classes, l'inventaire, les quêtes, les indices et les sauvegardes. Un client 3D séparé (web ou application, à décider) s'occupera de la scène, de la caméra, des déplacements, des combats et des interactions, et échangera avec Symfony par une API JSON (`src/Controller/Api/`).

## Prérequis

- PHP 8.2 ou plus récent, avec les extensions `ctype`, `iconv`, `intl`, `pdo_mysql` (ou `pdo_sqlite` / `pdo_pgsql`)
- [Composer](https://getcomposer.org/)
- Une base MySQL / MariaDB (WAMP, XAMPP, Laragon…) ; ou SQLite pour démarrer sans serveur
- Facultatif : la [CLI Symfony](https://symfony.com/download) pour le serveur local

## Installation

```bash
# 1. Installer les dépendances (les recettes Symfony complètent les fichiers de config manquants)
composer install

# 2. Configurer la base : créer .env.local avec ta propre DATABASE_URL, par exemple
#    DATABASE_URL="mysql://root:@127.0.0.1:3306/myth_of_eden?serverVersion=8.0.32&charset=utf8mb4"

# 3. Créer la base, générer la première migration et l'appliquer
php bin/console doctrine:database:create
php bin/console make:migration
php bin/console doctrine:migrations:migrate

# 4. Charger les données de jeu du prototype (classes, objets, première quête)
php bin/console doctrine:fixtures:load

# 5. Lancer le serveur
symfony serve        # ou : php -S 127.0.0.1:8000 -t public
```

Pendant `composer install`, Composer peut proposer d'ajouter une configuration Docker venant des recettes : réponds selon ton besoin (« no » si tu utilises WAMP/XAMPP/Laragon).

Pour vérifier le mapping des entités : `php bin/console doctrine:schema:validate`.

## Structure

```
src/
├── Controller/           Contrôleurs des pages (Twig)
│   └── Api/              Futurs points d'entrée JSON pour le client 3D
├── DataFixtures/         Données de jeu du prototype (classes, objets, quête)
├── Entity/               Modèle de données Doctrine
│   └── Embeddable/Stats  Caractéristiques réutilisées par classe et personnage
├── Enum/                 Catégories d'objet, emplacements d'équipement, statut de quête
└── Repository/           Requêtes Doctrine
templates/                Vues Twig
public/css/               Styles
public/models/            Modèles 3D optimisés servis au client (.glb)
assets-3d/                Sources 3D (.blend…) et registre des licences
```

## Modèle de données

| Entité | Rôle |
|---|---|
| `User` | Compte joueur (e-mail, mot de passe haché). `MAX_GAME_SAVES` emplacements de partie (3 par défaut). |
| `GameSave` | Une partie : emplacement, personnage, zone et position, temps de jeu, inventaire, quêtes, indices. |
| `Character` | Personnage : nom, apparence, classe, niveau, expérience, caractéristiques, santé actuelle. |
| `CharacterClass` | Classe jouable (donnée de jeu) avec ses avantages et ses caractéristiques de départ. |
| `Item` | Définition d'un objet : catégorie, emplacement d'équipement, bonus, effets, modèle 3D. |
| `InventoryItem` | Objet possédé dans une partie, avec quantité et emplacement équipé. |
| `Quest` / `QuestStep` | Quête (principale ou secondaire) et ses étapes ordonnées, avec la zone de chaque objectif. |
| `QuestProgress` | Avancement d'une quête dans une partie (étape en cours, statut). |
| `Clue` | Indice découvrable, rattaché ou non à une quête. |

Les données de jeu (classes, objets, quêtes, indices) ont un `code` stable, par exemple `mage` ou `enter_ruin`. Le client 3D l'utilise pour désigner ces éléments sans dépendre des identifiants de la base.

## Pages du site

| Adresse | Page |
|---|---|
| `/` | Cinématique d'entrée : portail 3D au défilement, puis connexion (ou « Mes parties » si connecté) |
| `/decouvrir` | Présentation du jeu : histoire, classes, actualités, inscription, FAQ |
| `/connexion`, `/inscription`, `/deconnexion` | Compte joueur |
| `/parties` | Emplacements de partie ; `/parties/nouvelle/{slot}` création ; `/parties/{id}` fiche ; `/parties/{id}/supprimer` |

## API JSON du jeu

Utilisée par le client 3D. Le joueur est identifié par sa session (même connexion que le site) ; il ne peut agir que sur ses propres parties (`GameSaveVoter`). Code : `src/Controller/Api/GameApiController.php` et `src/Service/GameStateService.php`.

| Méthode | Adresse | Corps JSON | Rôle |
|---|---|---|---|
| GET | `/api/parties/{id}` | — | État complet : personnage, statistiques (bonus inclus), position, inventaire, quêtes, indices |
| POST | `/api/parties/{id}/objets/ramasser` | `{"item": "engraved_pendant", "quantity": 1}` | Ajoute l'objet au sac (empile si possible) ; certains objets font avancer une quête et révèlent un indice |
| POST | `/api/parties/{id}/sauvegarde` | `{"zone": "village", "position": {"x": 0, "y": 0, "z": 0, "rotationY": 90}, "playedSeconds": 120}` | Enregistre la position, la zone et le temps de jeu |

Réponses d'erreur au format `{"error": "message"}` :

| Code | Cas |
|---|---|
| 400 | Corps qui n'est pas du JSON valide |
| 401 | Joueur non connecté |
| 403 | Partie appartenant à un autre joueur |
| 404 | Partie ou objet inconnu |
| 422 | Valeur invalide (quantité, zone, coordonnées, temps de jeu) |

Exemple depuis le navigateur (joueur connecté) :

```js
const state = await fetch('/api/parties/1').then((r) => r.json());
await fetch('/api/parties/1/objets/ramasser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: 'engraved_pendant' }),
});
```

## Front-end (animations et portail 3D)

- `assets/js/portal.js` : source du portail 3D (Three.js). Le site charge la version compilée `public/js/portal.bundle.js`.
  Pour la recompiler après modification (nécessite Node.js) :
  ```bash
  npm install three esbuild
  npx esbuild assets/js/portal.js --bundle --minify --format=esm --outfile=public/js/portal.bundle.js
  ```
- `public/js/intro.js` : cinématique d'entrée ; `public/js/home.js` : animations de la page Découvrir.
- `public/vendor/` : GSAP + ScrollTrigger (licence gratuite GSAP) et Lenis (MIT), servis tels quels.
- Les animations respectent le réglage « réduire les animations » du système.

## Prochaines étapes

1. Inscription, connexion et déconnexion
2. Création d'une partie : nom, apparence et classe du personnage ; suppression avec confirmation
3. Choix du client 3D et API JSON de chargement et de sauvegarde
4. Petite scène : déplacement et ramassage d'un objet enregistré dans Symfony
