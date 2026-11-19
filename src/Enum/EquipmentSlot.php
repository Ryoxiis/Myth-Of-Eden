<?php

namespace App\Enum;

enum EquipmentSlot: string
{
    case MainHand = 'main_hand';
    case OffHand = 'off_hand';
    case Head = 'head';
    case Body = 'body';
    case Hands = 'hands';
    case Feet = 'feet';
    case Accessory = 'accessory';

    public function label(): string
    {
        return match ($this) {
            self::MainHand => 'Main principale',
            self::OffHand => 'Main secondaire',
            self::Head => 'Tête',
            self::Body => 'Torse',
            self::Hands => 'Mains',
            self::Feet => 'Pieds',
            self::Accessory => 'Accessoire',
        };
    }
}
