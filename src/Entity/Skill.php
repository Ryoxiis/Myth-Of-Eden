<?php

namespace App\Entity;

use App\Enum\SkillType;
use App\Repository\SkillRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Compétence d'une classe (donnée de jeu). Elle se débloque à un niveau donné ;
 * le joueur la place ensuite dans sa barre de compétences depuis le grimoire.
 */
#[ORM\Entity(repositoryClass: SkillRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_SKILL_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Skill
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

    #[ORM\Column(type: Types::TEXT)]
    private string $description = '';

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?CharacterClass $characterClass = null;

    #[ORM\Column(length: 20, enumType: SkillType::class)]
    private SkillType $type = SkillType::Attack;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Range(min: 1, max: 50)]
    private int $requiredLevel = 1;

    /** Ordre d'affichage dans le grimoire, à niveau égal. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $position = 0;

    /** Temps de recharge en secondes. */
    #[ORM\Column]
    #[Assert\PositiveOrZero]
    private float $cooldown = 1.0;

    /** Coût en endurance. */
    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $cost = 0;

    /** Dégâts (attaques, sorts) ou points rendus (soins). */
    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\PositiveOrZero]
    private int $power = 0;

    /** Portée en mètres (0 = sur soi). « range » est un mot réservé de MySQL, d'où le nom de colonne. */
    #[ORM\Column(name: 'skill_range')]
    #[Assert\PositiveOrZero]
    private float $range = 0.0;

    /** Nom de l'icône dessinée par le client (sword, arrow, flame…). */
    #[ORM\Column(length: 40)]
    private string $icon = 'star';

    /** Animation du personnage (nom d'animation KayKit). */
    #[ORM\Column(length: 60)]
    private string $animation = 'Interact';

    /** Effet visuel joué par le client (slash, arrow, fire, frost, heal, shield…). */
    #[ORM\Column(length: 40)]
    private string $effect = 'slash';

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

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getCharacterClass(): ?CharacterClass
    {
        return $this->characterClass;
    }

    public function setCharacterClass(CharacterClass $characterClass): static
    {
        $this->characterClass = $characterClass;

        return $this;
    }

    public function getType(): SkillType
    {
        return $this->type;
    }

    public function setType(SkillType $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getRequiredLevel(): int
    {
        return $this->requiredLevel;
    }

    public function setRequiredLevel(int $requiredLevel): static
    {
        $this->requiredLevel = $requiredLevel;

        return $this;
    }

    public function isUnlockedAt(int $level): bool
    {
        return $level >= $this->requiredLevel;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): static
    {
        $this->position = $position;

        return $this;
    }

    public function getCooldown(): float
    {
        return $this->cooldown;
    }

    public function setCooldown(float $cooldown): static
    {
        $this->cooldown = $cooldown;

        return $this;
    }

    public function getCost(): int
    {
        return $this->cost;
    }

    public function setCost(int $cost): static
    {
        $this->cost = $cost;

        return $this;
    }

    public function getPower(): int
    {
        return $this->power;
    }

    public function setPower(int $power): static
    {
        $this->power = $power;

        return $this;
    }

    public function getRange(): float
    {
        return $this->range;
    }

    public function setRange(float $range): static
    {
        $this->range = $range;

        return $this;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): static
    {
        $this->icon = $icon;

        return $this;
    }

    public function getAnimation(): string
    {
        return $this->animation;
    }

    public function setAnimation(string $animation): static
    {
        $this->animation = $animation;

        return $this;
    }

    public function getEffect(): string
    {
        return $this->effect;
    }

    public function setEffect(string $effect): static
    {
        $this->effect = $effect;

        return $this;
    }
}
