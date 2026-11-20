<?php

namespace App\Enum;

/**
 * Rang d'un monstre : plus il est élevé, plus le monstre est solide et plus son butin est généreux.
 */
enum MonsterTier: string
{
    case Normal = 'normal';
    case Elite = 'elite';
    case Boss = 'boss';

    public function label(): string
    {
        return match ($this) {
            self::Normal => 'Normal',
            self::Elite => 'Élite',
            self::Boss => 'Boss',
        };
    }

    /** Bonus de chance ajouté au tirage des raretés. */
    public function luck(): float
    {
        return match ($this) {
            self::Normal => 0.0,
            self::Elite => 0.6,
            self::Boss => 1.5,
        };
    }

    public function experienceMultiplier(): float
    {
        return match ($this) {
            self::Normal => 1.0,
            self::Elite => 3.0,
            self::Boss => 6.0,
        };
    }

    /** [nombre d'objets garantis, chance (0-1) d'un objet de plus]. */
    public function dropRolls(): array
    {
        return match ($this) {
            self::Normal => [0, 0.4],
            self::Elite => [1, 0.5],
            self::Boss => [3, 0.75],
        };
    }

    /** Multiplicateur de runes gagnées. */
    public function runeMultiplier(): float
    {
        return match ($this) {
            self::Normal => 1.0,
            self::Elite => 4.0,
            self::Boss => 25.0,
        };
    }
}
