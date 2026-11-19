<?php

namespace App\Enum;

enum ItemCategory: string
{
    case Weapon = 'weapon';
    case Armor = 'armor';
    case Consumable = 'consumable';
    case Resource = 'resource';
    case Quest = 'quest';
    case Document = 'document';
    case Misc = 'misc';

    public function label(): string
    {
        return match ($this) {
            self::Weapon => 'Arme',
            self::Armor => 'Armure',
            self::Consumable => 'Consommable',
            self::Resource => 'Ressource',
            self::Quest => 'Objet de quête',
            self::Document => 'Document',
            self::Misc => 'Divers',
        };
    }
}
