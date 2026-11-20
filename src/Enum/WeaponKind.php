<?php

namespace App\Enum;

/**
 * Famille d'arme : elle décide de la forme de l'attaque de base (clic gauche),
 * de la caractéristique qui fait les dégâts et des compétences utilisables.
 */
enum WeaponKind: string
{
    case Melee = 'melee';
    case Ranged = 'ranged';
    case Magic = 'magic';

    public function label(): string
    {
        return match ($this) {
            self::Melee => 'Arme de corps à corps',
            self::Ranged => 'Arme à distance',
            self::Magic => 'Arme magique',
        };
    }

    /** Caractéristique qui fait monter les dégâts de cette famille d'arme. */
    public function damageStat(): string
    {
        return match ($this) {
            self::Melee => 'strength',
            self::Ranged => 'agility',
            self::Magic => 'magicMastery',
        };
    }

    /** Devine la famille d'une arme d'après son modèle 3D (bâton, arbalète, épée…). */
    public static function fromModel(string $modelPath): self
    {
        $model = strtolower(basename($modelPath));

        return match (true) {
            str_contains($model, 'staff'), str_contains($model, 'wand') => self::Magic,
            str_contains($model, 'bow') => self::Ranged,
            default => self::Melee,
        };
    }
}
