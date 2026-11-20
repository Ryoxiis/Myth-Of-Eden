<?php

namespace App\Entity\Embeddable;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Caractéristiques d'un personnage (ou valeurs de départ d'une classe).
 * Intégré dans les tables character_class (préfixe base_) et game_character.
 */
#[ORM\Embeddable]
class Stats
{
    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $health = 100;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $stamina = 100;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $strength = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $agility = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $stealth = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $magicMastery = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $tracking = 1;

    public function __construct(
        int $health = 100,
        int $stamina = 100,
        int $strength = 1,
        int $agility = 1,
        int $stealth = 1,
        int $magicMastery = 1,
        int $tracking = 1,
    ) {
        $this->health = $health;
        $this->stamina = $stamina;
        $this->strength = $strength;
        $this->agility = $agility;
        $this->stealth = $stealth;
        $this->magicMastery = $magicMastery;
        $this->tracking = $tracking;
    }

    public function copy(): self
    {
        return new self(
            $this->health,
            $this->stamina,
            $this->strength,
            $this->agility,
            $this->stealth,
            $this->magicMastery,
            $this->tracking,
        );
    }

    /** @return array<string, int> */
    public function toArray(): array
    {
        return [
            'health' => $this->health,
            'stamina' => $this->stamina,
            'strength' => $this->strength,
            'agility' => $this->agility,
            'stealth' => $this->stealth,
            'magicMastery' => $this->magicMastery,
            'tracking' => $this->tracking,
        ];
    }

    public function getHealth(): int
    {
        return $this->health;
    }

    public function setHealth(int $health): static
    {
        $this->health = $health;

        return $this;
    }

    public function getStamina(): int
    {
        return $this->stamina;
    }

    public function setStamina(int $stamina): static
    {
        $this->stamina = $stamina;

        return $this;
    }

    public function getStrength(): int
    {
        return $this->strength;
    }

    public function setStrength(int $strength): static
    {
        $this->strength = $strength;

        return $this;
    }

    public function getAgility(): int
    {
        return $this->agility;
    }

    public function setAgility(int $agility): static
    {
        $this->agility = $agility;

        return $this;
    }

    public function getStealth(): int
    {
        return $this->stealth;
    }

    public function setStealth(int $stealth): static
    {
        $this->stealth = $stealth;

        return $this;
    }

    public function getMagicMastery(): int
    {
        return $this->magicMastery;
    }

    public function setMagicMastery(int $magicMastery): static
    {
        $this->magicMastery = $magicMastery;

        return $this;
    }

    public function getTracking(): int
    {
        return $this->tracking;
    }

    public function setTracking(int $tracking): static
    {
        $this->tracking = $tracking;

        return $this;
    }

    /**
     * Ajoute des points à certaines caractéristiques, ex. ["health" => 6, "strength" => 1].
     *
     * @param array<string, int> $deltas
     */
    public function increase(array $deltas): void
    {
        foreach ($deltas as $stat => $value) {
            if (property_exists($this, $stat)) {
                $this->{$stat} += $value;
            }
        }
    }
}
