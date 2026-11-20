<?php

namespace App\Entity;

use App\Enum\MonsterTier;
use App\Repository\MonsterRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Type de monstre d'une zone (donnée de jeu). Ses valeurs sont celles du niveau 1 :
 * le client et le serveur les font grandir avec le niveau du monstre rencontré.
 */
#[ORM\Entity(repositoryClass: MonsterRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_MONSTER_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Monster
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\ManyToOne(inversedBy: 'monsters')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Zone $zone = null;

    #[ORM\Column(length: 20, enumType: MonsterTier::class)]
    private MonsterTier $tier = MonsterTier::Normal;

    /** Modèle 3D (fichier de public/models/monsters, sans extension). */
    #[ORM\Column(length: 60)]
    private string $model = 'skeleton_minion';

    /** Arme tenue (fichier de public/models/equipment, sans extension), facultative. */
    #[ORM\Column(length: 60, nullable: true)]
    private ?string $weapon = null;

    /** Teinte appliquée au modèle (#rrggbb), pour varier les monstres qui partagent un modèle. */
    #[ORM\Column(length: 7, nullable: true)]
    private ?string $tint = null;

    #[ORM\Column]
    #[Assert\Positive]
    private float $scale = 1.0;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $baseHealth = 40;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $baseDamage = 5;

    /** Portée d'attaque en mètres (au-delà de 4 m : attaque à distance). */
    #[ORM\Column]
    private float $attackRange = 1.8;

    #[ORM\Column]
    private float $speed = 2.6;

    /** Expérience de base, multipliée par le niveau et le rang. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $experience = 12;

    /** Nombre d'exemplaires dans la zone (le boss est unique). */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $population = 20;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getZone(): ?Zone
    {
        return $this->zone;
    }

    public function setZone(Zone $zone): static
    {
        $this->zone = $zone;

        return $this;
    }

    public function getTier(): MonsterTier
    {
        return $this->tier;
    }

    public function setTier(MonsterTier $tier): static
    {
        $this->tier = $tier;

        return $this;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): static
    {
        $this->model = $model;

        return $this;
    }

    public function getWeapon(): ?string
    {
        return $this->weapon;
    }

    public function setWeapon(?string $weapon): static
    {
        $this->weapon = $weapon;

        return $this;
    }

    public function getTint(): ?string
    {
        return $this->tint;
    }

    public function setTint(?string $tint): static
    {
        $this->tint = $tint;

        return $this;
    }

    public function getScale(): float
    {
        return $this->scale;
    }

    public function setScale(float $scale): static
    {
        $this->scale = $scale;

        return $this;
    }

    public function getBaseHealth(): int
    {
        return $this->baseHealth;
    }

    public function getBaseDamage(): int
    {
        return $this->baseDamage;
    }

    public function setCombat(int $baseHealth, int $baseDamage, float $attackRange, float $speed): static
    {
        $this->baseHealth = $baseHealth;
        $this->baseDamage = $baseDamage;
        $this->attackRange = $attackRange;
        $this->speed = $speed;

        return $this;
    }

    public function getAttackRange(): float
    {
        return $this->attackRange;
    }

    public function getSpeed(): float
    {
        return $this->speed;
    }

    public function getExperience(): int
    {
        return $this->experience;
    }

    public function setExperience(int $experience): static
    {
        $this->experience = $experience;

        return $this;
    }

    public function getPopulation(): int
    {
        return $this->population;
    }

    public function setPopulation(int $population): static
    {
        $this->population = $population;

        return $this;
    }

    /** Expérience gagnée en battant ce monstre au niveau donné. */
    public function experienceAt(int $level): int
    {
        return (int) round($this->experience * (1 + ($level - 1) * 0.35) * $this->tier->experienceMultiplier());
    }

    /** Niveau maximal autorisé : celui de la zone, +3 pour un boss. */
    public function maxLevel(): int
    {
        return ($this->zone?->getMaxLevel() ?? 1) + (\App\Enum\MonsterTier::Boss === $this->tier ? 3 : 0);
    }

    public function minLevel(): int
    {
        return $this->zone?->getMinLevel() ?? 1;
    }
}
