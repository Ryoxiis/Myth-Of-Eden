<?php

namespace App\Enum;

/**
 * Rareté d'un objet trouvé. L'ordre des cas va du plus courant au plus rare.
 */
enum Rarity: string
{
    case Common = 'common';
    case Uncommon = 'uncommon';
    case Rare = 'rare';
    case Epic = 'epic';
    case Legendary = 'legendary';
    case Cosmic = 'cosmic';
    case Omniversal = 'omniversal';

    public function label(): string
    {
        return match ($this) {
            self::Common => 'Commun',
            self::Uncommon => 'Peu commun',
            self::Rare => 'Rare',
            self::Epic => 'Épique',
            self::Legendary => 'Légendaire',
            self::Cosmic => 'Cosmique',
            self::Omniversal => 'Omniversel',
        };
    }

    /** Couleur d'affichage (texte, lueur de l'arme, rayon du butin). */
    public function color(): string
    {
        return match ($this) {
            self::Common => '#a7a7a7',
            self::Uncommon => '#4fd36b',
            self::Rare => '#3f8cff',
            self::Epic => '#b360ff',
            self::Legendary => '#ffc832',
            self::Cosmic => '#1a1024',
            self::Omniversal => '#ff5fd2',
        };
    }

    /** Rang de 0 (commun) à 6 (omniversel). */
    public function rank(): int
    {
        return array_search($this, self::cases(), true);
    }

    /** Poids de base dans le tirage, avant le bonus de chance du monstre. */
    public function baseWeight(): float
    {
        return [1000, 420, 160, 55, 14, 3, 0.6][$this->rank()];
    }

    /** Multiplicateur appliqué aux statistiques de l'objet. */
    public function statMultiplier(): float
    {
        return [1, 1.25, 1.6, 2.1, 2.8, 3.8, 5][$this->rank()];
    }

    /** Nombre de bonus supplémentaires tirés au hasard. */
    public function extraAffixes(): int
    {
        return min(4, $this->rank());
    }

    /** Multiplicateur de valeur marchande. */
    public function priceMultiplier(): float
    {
        return [1, 2, 4, 9, 20, 45, 100][$this->rank()];
    }
}
