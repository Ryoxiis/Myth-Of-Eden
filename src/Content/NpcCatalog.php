<?php

namespace App\Content;

/**
 * Contenu des PNJ (position, apparence, dialogues), partagé entre les fixtures
 * et la commande app:pnj:installer (qui les ajoute à une base déjà en service).
 */
final class NpcCatalog
{
    /**
     * @return list<array{code: string, name: string, title: string, zone: string, x: float, z: float, rotation: float, model: string, tint: ?string, questStep: ?string, clue: ?string, questDialogue: list<string>, idleDialogue: list<string>}>
     */
    public static function all(): array
    {
        return [
            [
                'code' => 'oldin',
                'name' => 'Oldin',
                'title' => 'Vieil ermite du village',
                'zone' => 'village',
                'x' => -3.4,
                'z' => 3.2,
                'rotation' => 133.0,
                'model' => 'mage',
                'tint' => '#a08a6a',
                'questStep' => 'ask_villagers',
                'clue' => 'forest_light_testimony',
                'questDialogue' => [
                    'Ah, te voilà enfin. Ce pendentif… je l\'ai vu au cou de ton compagnon, le soir où il est parti.',
                    'Depuis trois nuits, une lumière danse entre les arbres, du côté des vieilles pierres. Bleue, froide, comme un souffle de magie.',
                    'Les autres font semblant de ne rien voir. Ici, on a peur de ce qu\'on ne comprend pas.',
                    'Prends le chemin de la forêt, au sud. Et garde ce pendentif sur toi : il pourrait bien t\'ouvrir des portes.',
                ],
                'idleDialogue' => [
                    'La forêt n\'est plus sûre, mon enfant. Les morts ne dorment plus du côté de Sombrebois.',
                    'Suis le chemin vers le sud : la lumière venait des vieilles pierres, au bout de la forêt.',
                ],
            ],
        ];
    }
}
