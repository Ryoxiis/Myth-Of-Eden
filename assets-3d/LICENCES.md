# Registre des modèles 3D

Chaque modèle récupéré sur Internet doit être noté ici **avant** d'être utilisé dans le jeu.
Sur Free3D, les modèles « FREE » n'ont pas tous la même licence : vérifie la page de chaque modèle et les conditions du site.
Garde une capture ou une copie du texte de la licence dans `assets-3d/licences/` en cas de doute.

| Modèle | Fichier dans le projet | Auteur | Page d'origine | Licence | Usage autorisé (perso / école / commercial) | Modifications faites |
|---|---|---|---|---|---|---|
| _exemple : Épée courte_ | `public/models/items/short_sword.glb` | _pseudo_ | _URL_ | _CC-BY 4.0, Personal Use…_ | _école oui, commercial non_ | _réduit à 5k triangles, texture 1024px_ |

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
