<?php

namespace App\Enum;

enum SkillType: string
{
    case Attack = 'attack';
    case Spell = 'spell';
    case Defense = 'defense';
    case Heal = 'heal';
    case Buff = 'buff';
    case Utility = 'utility';

    public function label(): string
    {
        return match ($this) {
            self::Attack => 'Attaque',
            self::Spell => 'Sort',
            self::Defense => 'Défense',
            self::Heal => 'Soin',
            self::Buff => 'Renforcement',
            self::Utility => 'Utilitaire',
        };
    }

    /** Les compétences offensives infligent des dégâts aux cibles touchées. */
    public function isOffensive(): bool
    {
        return self::Attack === $this || self::Spell === $this;
    }
}
