# Modèles 3D à télécharger pour le prototype

> **Direction choisie : « réalisme stylisé ».** Décor et objets le plus réalistes possible (Poly Haven, Sketchfab),
> personnages humains réalistes (Mixamo), et les kits Quaternius/KayKit seulement en complément ou en solution de
> secours (maisons modulaires « réalisme-isées » avec des textures réelles). C'est l'éclairage de nuit qui fera
> l'essentiel du rendu. Voir la section « Piste réaliste » juste en dessous.

## Piste réaliste (prioritaire)

| # | Source | Lien | Licence | Dossier | À prendre |
|---|---|---|---|---|---|
| R1 | Poly Haven : modèles scannés | https://polyhaven.com/models | CC0 | `realiste/polyhaven` | Rochers, falaises, souches, troncs, racines, plantes, buissons, champignons ; accessoires (tonneaux, caisses, lanternes, meubles, outils). Format **glTF**, résolution **1K** (2K pour les gros rochers). |
| R2 | Poly Haven : textures | https://polyhaven.com/textures | CC0 | `textures` | Herbe, terre, chemin, pavés, pierre moussue, écorce, bois de planches, crépi, chaume (1K, JPG) |
| R3 | Poly Haven : ciels HDRI | https://polyhaven.com/hdris (filtre « Night ») | CC0 | `ciel` | 1 ou 2 ciels de nuit (1K ou 2K, HDR) |
| R4 | Mixamo (Adobe) : personnages et animations | https://www.mixamo.com | Gratuit avec un compte Adobe, **pas CC0** : lire les conditions | `realiste/mixamo` | 1 personnage humain par silhouette (féminine / masculine) en **FBX for Unity**, puis les animations *Idle, Walking, Running, Jump, Picking Up, Sword and Shield Slash, Standing Draw Arrow, Magic Spell, Death* (cocher « In Place ») |
| R5 | Sketchfab : modèles médiévaux réalistes | https://sketchfab.com/search?features=downloadable&type=models (rechercher « medieval house », « stone arch ruin », « medieval well », « pendant amulet », « longbow », « wizard staff ») | Variable : ne prendre que **CC0** ou **CC-BY** (citer l'auteur) | `realiste/sketchfab` | Maisons à colombages, puits, arche en ruine, pendentif, arc, bâton, épée. Choisir des modèles **« low/mid poly, PBR »** de moins de 50 000 triangles. Télécharger au format **glTF**. |
| R6 | ambientCG : textures | https://ambientcg.com | CC0 | `textures` | Compléments de R2 |

**Règles pour un rendu homogène**
- Même échelle partout : 1 unité = 1 mètre (vérifier dans Blender : une porte ≈ 2 m).
- Textures limitées à 1K-2K, modèles allégés si besoin (Blender → modificateur *Decimate*).
- Une seule palette : bois brun, pierre grise moussue, lumières chaudes, et le turquoise réservé à la magie.
- Chaque modèle Sketchfab ou Mixamo est noté dans `LICENCES.md` (auteur, lien, licence) **avant** d'être utilisé.

## Kits complets (complément ou solution de secours)

Base choisie : les kits **Quaternius**, tous en **CC0** (domaine public : usage libre, même commercial, sans obligation de citer l'auteur)
et disponibles en **glTF**, le format chargé directement par Babylon.js / Three.js / Godot.
Un seul auteur = un style cohérent entre maisons, accessoires, nature et personnages.
Complément réaliste (sol, rochers, éclairage du ciel) : **Poly Haven**, également en CC0.

> Style : les kits Quaternius sont « stylisés » (formes simples, couleurs douces). Pour se rapprocher de l'ambiance
> réaliste du site, on jouera sur l'éclairage nocturne, le brouillard et les textures Poly Haven.

## Où les mettre

Décompresser chaque archive dans `assets-3d/sources/<dossier>` (dossier non envoyé sur GitHub, trop lourd).
On copiera ensuite seulement les modèles utilisés, en `.glb`, dans `public/models/…`.

| # | Pack | Lien | Fichier à prendre | Dossier de destination | Sert à |
|---|---|---|---|---|---|
| 1 | Medieval Village MegaKit (300+ pièces modulaires) | https://quaternius.itch.io/medieval-village-megakit | `[Standard].zip` (gratuit, « Name your own price » → 0 €) | `assets-3d/sources/village` | Maisons du village, murs, toits, portes, puits, clôtures, ruine |
| 2 | Fantasy Props MegaKit (200+ accessoires) | https://quaternius.itch.io/fantasy-props-megakit | `[Standard].zip` | `assets-3d/sources/props` | Armes (épée, arc, bâton), coffres, tonneaux, potions, livres, nourriture, étals |
| 3 | Stylized Nature MegaKit (110+ éléments) | https://quaternius.itch.io/ (rechercher « Stylized Nature MegaKit ») | version gratuite | `assets-3d/sources/nature` | Arbres, sapins, buissons, rochers, herbes, champignons |
| 4 | Universal Base Characters | https://quaternius.itch.io/ (rechercher « Universal Base Characters ») | version gratuite | `assets-3d/sources/personnages` | Corps du personnage joueur (silhouettes féminine/masculine) |
| 5 | Universal Animation Library (120+ animations) | https://quaternius.itch.io/ (rechercher « Universal Animation Library ») | version gratuite | `assets-3d/sources/animations` | Marche, course, saut, ramasser, attaque, mort… |
| 6 | Modular Character Outfits – Fantasy | https://quaternius.itch.io/ (rechercher « Modular Character Outfits ») | version gratuite | `assets-3d/sources/tenues` | Tenues des 4 classes (cape d'éclaireur, armure, manteau de voyage, robe de mage) |
| 7 | Poly Haven : textures de sol (herbe, chemin de terre, pavés, pierre moussue) | https://polyhaven.com/textures | résolution **1K**, format **JPG** | `assets-3d/sources/textures` | Sol du village et de la forêt, pierre de la ruine |
| 8 | Poly Haven : ciel de nuit (HDRI) | https://polyhaven.com/hdris (filtre « Night ») | **1K**, format **HDR** | `assets-3d/sources/ciel` | Lumière et reflets de nuit |

Sur itch.io : cliquer « Download Now », puis « No thanks, just take me to the downloads » pour la version gratuite.

## Compléments (pour aller plus vite et enrichir le rendu)

Mêmes règles : CC0, glTF, décompresser dans `assets-3d/sources/<dossier>`.

| # | Pack | Lien | Dossier | Sert à |
|---|---|---|---|---|
| 9 | KayKit – Character Pack : Adventurers (personnages riggés et animés + accessoires) | https://kaylousberg.itch.io/kaykit-adventurers | `personnages-kaykit` | **Plan B le plus rapide** pour le joueur : prêt à marcher/courir sans assemblage |
| 10 | KayKit – Character Animations | https://kaylousberg.itch.io/ (rechercher « Character Animations ») | `animations` | Animations compatibles avec les personnages KayKit |
| 11 | KayKit – Character Pack : Skeletons | https://kaylousberg.itch.io/ (rechercher « Skeletons ») | `ennemis` | Premiers ennemis (gardiens de la ruine) pour le combat simple |
| 12 | KayKit – Dungeon Pack Remastered | https://kaylousberg.itch.io/ (rechercher « Dungeon Pack Remastered ») | `ruine` | Intérieur de la ruine : murs, piliers, escaliers, coffres, torches |
| 13 | KayKit – Forest Nature Pack (200+ éléments) | https://kaylousberg.itch.io/kaykit-forest | `nature` | Arbres, buissons, rochers, herbes, terrain (complète le pack 3) |
| 14 | ambientCG – textures PBR | https://ambientcg.com (Grass, Ground, Rock, Moss, Bark, Planks) | `textures` | Variantes de sols, écorce, bois des maisons (résolution 1K, JPG) |
| 15 | Sons d'ambiance et bruitages | https://freesound.org (filtre licence « Creative Commons 0 ») et https://opengameart.org (filtre CC0) | `sons` | Forêt de nuit, vent, feu de camp, pas, ramasser, magie, porte |
| 16 | Musique | https://opengameart.org (recherche « medieval ambient », licence CC0) | `musique` | Thème du village, ambiance de la forêt, tension dans la ruine |

> Conseil de cohérence : choisir **un** jeu de personnages (Quaternius 4-5-6 **ou** KayKit 9-10) et s'y tenir.
> Pour le décor, Quaternius (village, accessoires) + KayKit/Quaternius (nature) se marient bien.

## Pour un beau rendu (à appliquer dans le moteur)

- Exporter en **.glb** (un seul fichier par modèle) ; textures 1K ou 2K maximum.
- Nuit : lumière de lune bleutée faible + **ciel HDRI de nuit** (pack 8) + **brouillard** exponentiel (couleur du ciel).
- Lumières chaudes ponctuelles (lanternes, fenêtres, feu de camp) avec ombres sur 2-3 lumières seulement.
- Effet de lueur (« glow ») sur la magie turquoise, les runes et les lanternes ; quelques particules (lucioles, braises).
- Post-traitement léger : tonemapping ACES, vignettage, un peu de grain : la même ambiance que le site.

## Ce dont le prototype a besoin (à extraire des packs)

- **Village** : 3 à 5 maisons (pack 1), un puits, des clôtures, des lanternes, le sol (pack 7).
- **Maison du compagnon** : une maison du pack 1 avec une porte, et le **pendentif gravé** devant (pack 2 si un bijou convient, sinon on le modélise dans Blender : un disque et une chaîne suffisent).
- **Chemin de la forêt** : sapins, rochers, buissons (pack 3).
- **Ruine** : murs et arches en pierre du pack 1 (ou des rochers), plus notre portail turquoise du site, déjà prêt en code.
- **Personnage** : corps (pack 4) + tenue selon la classe (pack 6) + animations marche/course/ramasser (pack 5).
- **Objets ramassables** : pomme, bandage, épée courte, arc, bâton (pack 2), avec les mêmes codes que dans Symfony (`apple`, `bandage`, `short_sword`, `hunting_bow`, `oak_staff`, `engraved_pendant`).

Après chaque téléchargement, ajouter une ligne dans `LICENCES.md` (pack, auteur, lien, licence CC0).
