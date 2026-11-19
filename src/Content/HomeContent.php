<?php

namespace App\Content;

/**
 * Contenu éditorial de la page d'accueil (journal de développement, FAQ).
 * Contenu statique pour le prototype ; il pourra devenir une entité Article plus tard.
 */
final class HomeContent
{
    /**
     * Image facultative dans public/images/{image} ; sans fichier, une illustration dessinée (theme) s'affiche.
     *
     * @return list<array{title: string, summary: string, date: string, tag: string, theme: string, image?: string, position?: string, featured?: bool}>
     */
    public function getNews(): array
    {
        return [
            [
                'title' => 'Chapitre I : La lumière dans la forêt',
                'summary' => 'Un objet laissé devant ta porte, une lueur entre les arbres et une ruine oubliée. Le premier chapitre du prototype pose les bases de l\'enquête.',
                'date' => '2026-11-19',
                'tag' => 'Histoire',
                'theme' => 'forest',
                'image' => 'news/chapitre-1.jpg',
                'position' => '72% center',
                'featured' => true,
            ],
            [
                'title' => 'Comptes et sauvegardes',
                'summary' => 'Inscription, connexion et trois emplacements de partie par compte.',
                'date' => '2026-11-19',
                'tag' => 'Nouveauté',
                'theme' => 'village',
                'image' => 'news/comptes.jpg',
                'position' => 'center 40%',
            ],
            [
                'title' => 'Quatre classes jouables',
                'summary' => 'Éclaireur, Combattant, Voyageur et Mage : chacun ses forces dès le départ.',
                'date' => '2026-11-19',
                'tag' => 'Classes',
                'theme' => 'magic',
                'image' => 'news/classes.jpg',
            ],
            [
                'title' => 'Vers la ruine oubliée',
                'summary' => 'Prochaine étape : une première scène 3D, du village jusqu\'à l\'entrée de la ruine.',
                'date' => '2026-11-26',
                'tag' => 'À venir',
                'theme' => 'ruin',
                'image' => 'news/ruine.jpg',
                'position' => 'center 48%',
            ],
        ];
    }

    /**
     * Les trois chapitres racontés au défilement dans la section « Le monde ».
     *
     * @return list<array{number: string, kicker: string, title: string, text: string, image: string, position: string}>
     */
    public function getChapters(): array
    {
        return [
            [
                'number' => '01',
                'kicker' => 'Le retour',
                'title' => 'Un village qui t\'attendait',
                'text' => 'Les lanternes s\'allument, les habitants te saluent par ton nom. Mais devant ta porte, un objet t\'attend, laissé par celui ou celle que tu as perdu de vue.',
                'image' => 'village.jpg',
                'position' => 'center 70%',
            ],
            [
                'number' => '02',
                'kicker' => 'La lumière',
                'title' => 'Une lueur dans la forêt',
                'text' => 'Au cœur des bois, une ruine oubliée s\'éveille. Ses runes brillent d\'une magie que tout le monde craint, et que ton compagnon avait commencé à comprendre.',
                'image' => 'hero.jpg',
                'position' => 'center 60%',
            ],
            [
                'number' => '03',
                'kicker' => 'Le voyage',
                'title' => 'Une légende à déterrer',
                'text' => 'Un royaume disparu, une créature ancienne, un secret de famille. Chaque indice te rapproche de la vérité, et de ton propre passé.',
                'image' => 'camp.jpg',
                'position' => 'center 70%',
            ],
        ];
    }

    /**
     * @return list<array{question: string, answer: string}>
     */
    public function getFaq(): array
    {
        return [
            [
                'question' => 'Qu\'est-ce que Myth of Eden ?',
                'answer' => 'Un jeu d\'aventure solo en 3D, à la troisième personne, dans un monde médiéval fantastique. Tu pars à la recherche de ton ancien compagnon disparu, dont la disparition est liée à une ancienne légende et à ton propre passé.',
            ],
            [
                'question' => 'Le jeu est-il gratuit ?',
                'answer' => 'Oui. Crée un compte, choisis ta classe et commence l\'aventure.',
            ],
            [
                'question' => 'Combien de parties puis-je avoir ?',
                'answer' => 'Chaque compte dispose de trois emplacements de partie. Chaque partie est identifiée par le nom de son personnage et se sauvegarde automatiquement après les événements importants.',
            ],
            [
                'question' => 'Puis-je changer de classe en cours de route ?',
                'answer' => 'Non : la classe choisie au début reste la même pendant toute l\'aventure. Elle change tes caractéristiques et ta façon de combattre, mais toutes les classes peuvent apprendre la magie.',
            ],
            [
                'question' => 'Que se passe-t-il si je perds un combat ?',
                'answer' => 'Tu reviens au dernier point de sauvegarde. Les blessures n\'ont pas d\'effet durable et se soignent simplement.',
            ],
        ];
    }
}
