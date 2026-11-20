# Registre des modèles 3D

Chaque modèle récupéré sur Internet doit être noté ici **avant** d'être utilisé dans le jeu.
Sur Free3D, les modèles « FREE » n'ont pas tous la même licence : vérifie la page de chaque modèle et les conditions du site.
Garde une capture ou une copie du texte de la licence dans `assets-3d/licences/` en cas de doute.

| Modèle | Fichier dans le projet | Auteur | Page d'origine | Licence | Usage autorisé (perso / école / commercial) | Modifications faites |
|---|---|---|---|---|---|---|
| Village Pack (maisons, auberge, scierie, puits, arbres, buissons, rochers, lanternes, clôtures, caisses, tonneaux, murs et arche) | `public/models/village/*.glb` | Babylon.js (équipe Babylon.js / Microsoft) | https://github.com/BabylonJS/Assets/tree/master/meshes/Demos/village | **CC-BY 4.0** — crédit obligatoire : « Village Pack — Babylon.js, CC-BY 4.0 » | école oui, commercial oui avec crédit | textures réduites à 1024 px et converties en WebP (gltf-transform) |
| Textures du terrain (herbe + relief, terre, sol rocheux, normales), lueur | `public/models/textures/{grass,dirt,rock}_*.jpg`, `flare2.png` | Babylon.js | https://github.com/BabylonJS/Assets/tree/master/textures | **CC-BY 4.0** (même dépôt) | école oui, commercial oui avec crédit | redimensionnées, terre assombrie, converties en JPEG |
| Touffe d'herbe (carte alpha) | `public/models/textures/grass_card.png` | Babylon.js (démo UnderWaterScene) | https://github.com/BabylonJS/Assets/tree/master/meshes/Demos/UnderWaterScene/grass | **CC-BY 4.0** | idem | éclaircie, couleurs étendues sous la transparence |
| Éclairage d'environnement de nuit | `public/models/textures/night.env` | Babylon.js | https://github.com/BabylonJS/Assets/tree/master/ibl | **CC-BY 4.0** | idem | aucune |
| KayKit Character Pack : Adventurers (Rogue capuche, Knight, Barbarian, Mage) | `public/models/characters/{scout,fighter,traveler,mage}.glb` | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | **CC0** (domaine public, crédit apprécié) | tout usage | renommés par classe, textures en WebP ; animations incluses (Idle, Walking_A, Running_A, PickUp…) |
| KayKit Character Pack : Skeletons (Minion, Warrior, Rogue, Mage) + armes et boucliers en os | `public/models/monsters/skeleton_*.glb`, `public/models/equipment/skeleton_*.glb` | Kay Lousberg (KayKit) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 | **CC0** | tout usage | animations réduites aux utiles, textures en WebP |
| Bandits et chevalier déchu (Rogue, Barbarian, Knight) | `public/models/monsters/bandit_*.glb`, `fallen_knight.glb` | Kay Lousberg (KayKit Adventurers) | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | **CC0** | tout usage | teintés en jeu, animations réduites |
| Armes et boucliers (épées, haches, dague, arbalètes, bâton, baguette, grimoire, carquois, boucliers) | `public/models/equipment/*.glb` | Kay Lousberg (KayKit Adventurers) | même dépôt | **CC0** | tout usage | textures 512 px WebP |
| Coffres (bois, or) | `public/models/equipment/chest*.glb` | Kay Lousberg (KayKit Dungeon Remastered) | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0 | **CC0** | tout usage | textures 512 px WebP |
| Pendentif gravé | généré par le code (`assets/js/game/pendant.js`) | projet | — | — | — | modèle procédural (anneau + pierre) |

## Registre des images du site

| Image | Fichier | Auteur / source | Page d'origine | Licence | Modifications |
|---|---|---|---|---|---|
| Chemin forestier brumeux aux rayons de lumière (IA) | `public/images/news/chapitre-1.jpg` | © pakutaso | https://www.pakutaso.com/en/20250505123k-1mark-23.html | Pakutaso : usage commercial et non commercial gratuit (voir leurs conditions) | assombrie, réchauffée, vignettage, compressée |
| Salle d'archives médiévale aux bougies (IA) | `public/images/news/comptes.jpg` | © pakutaso | https://www.pakutaso.com/en/20240630169post-28950.html | Pakutaso (idem) | assombrie, réchauffée, vignettage, compressée |
| Arche de pierre moussue en forêt brumeuse (IA) | `public/images/news/ruine.jpg` | © pakutaso | https://www.pakutaso.com/en/20220259044post-43975.html | Pakutaso (idem) | assombrie, réchauffée, vignettage, compressée |
| Décors, logo et portraits de classe | `public/images/*.jpg`, `logo*.png`, `classes/*.jpg` | Générés par IA pour le projet | — | Selon les conditions de l'outil de génération utilisé | détourage, recadrage, compression |
| Montage « Quatre classes » | `public/images/news/classes.jpg` | Composé à partir des portraits de classe | — | Idem portraits | — |

## Règles du projet

- Format servi au jeu : **glTF binaire (`.glb`)**, exporté depuis Blender (Fichier → Exporter → glTF 2.0).
- Sources (`.blend`, `.fbx`, `.obj`, textures d'origine) : `assets-3d/sources/`. Ce dossier n'est pas versionné.
- Viser des modèles légers : peu de polygones pour les objets ramassables, textures en 1024 ou 2048 px.
- Harmoniser l'échelle (1 unité = 1 mètre) et l'orientation dans Blender avant l'export.
