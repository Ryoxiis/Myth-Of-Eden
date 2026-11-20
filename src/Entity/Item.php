<?php

namespace App\Entity;

use App\Enum\EquipmentSlot;
use App\Enum\ItemCategory;
use App\Repository\ItemRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Définition d'un objet du jeu (donnée de jeu). Les exemplaires possédés sont des InventoryItem.
 */
#[ORM\Entity(repositoryClass: ItemRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_ITEM_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Item
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** Identifiant stable utilisé par le client 3D (ex. "healing_herb"). */
    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    #[ORM\Column(length: 120)]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    private string $description = '';

    #[ORM\Column(enumType: ItemCategory::class)]
    private ItemCategory $category = ItemCategory::Misc;

    /** Emplacement d'équipement, ou null si l'objet ne s'équipe pas. */
    #[ORM\Column(nullable: true, enumType: EquipmentSlot::class)]
    private ?EquipmentSlot $equipmentSlot = null;

    #[ORM\Column]
    private bool $stackable = false;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $maxStack = 1;

    /**
     * Bonus de caractéristiques quand l'objet est équipé, ex. ["strength" => 2].
     *
     * @var array<string, int>
     */
    #[ORM\Column]
    private array $statBonuses = [];

    /**
     * Effets à l'utilisation, ex. ["heal" => 25].
     *
     * @var array<string, mixed>
     */
    #[ORM\Column]
    private array $effects = [];

    /** Peut être trouvé sur les monstres. */
    #[ORM\Column(options: ['default' => false])]
    private bool $lootable = false;

    /** Niveau de monstre minimal pour que l'objet puisse tomber. */
    #[ORM\Column(type: Types::SMALLINT, options: ['default' => 1])]
    private int $dropLevel = 1;

    /** Valeur de base en runes (prix chez le marchand pour un objet commun de niveau 1). */
    #[ORM\Column(options: ['default' => 0])]
    private int $price = 0;

    /** Chemin du modèle 3D servi au client, ex. "models/items/healing_herb.glb". */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $modelPath = null;

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

    public function getCategory(): ItemCategory
    {
        return $this->category;
    }

    public function setCategory(ItemCategory $category): static
    {
        $this->category = $category;

        return $this;
    }

    public function getEquipmentSlot(): ?EquipmentSlot
    {
        return $this->equipmentSlot;
    }

    public function setEquipmentSlot(?EquipmentSlot $equipmentSlot): static
    {
        $this->equipmentSlot = $equipmentSlot;

        return $this;
    }

    public function isEquippable(): bool
    {
        return null !== $this->equipmentSlot;
    }

    public function isStackable(): bool
    {
        return $this->stackable;
    }

    public function setStackable(bool $stackable, int $maxStack = 1): static
    {
        $this->stackable = $stackable;
        $this->maxStack = $stackable ? max(1, $maxStack) : 1;

        return $this;
    }

    public function getMaxStack(): int
    {
        return $this->maxStack;
    }

    /** @return array<string, int> */
    public function getStatBonuses(): array
    {
        return $this->statBonuses;
    }

    /** @param array<string, int> $statBonuses */
    public function setStatBonuses(array $statBonuses): static
    {
        $this->statBonuses = $statBonuses;

        return $this;
    }

    /** @return array<string, mixed> */
    public function getEffects(): array
    {
        return $this->effects;
    }

    /** @param array<string, mixed> $effects */
    public function setEffects(array $effects): static
    {
        $this->effects = $effects;

        return $this;
    }

    public function getModelPath(): ?string
    {
        return $this->modelPath;
    }

    public function setModelPath(?string $modelPath): static
    {
        $this->modelPath = $modelPath;

        return $this;
    }

    public function isLootable(): bool
    {
        return $this->lootable;
    }

    /** Rend l'objet trouvable sur les monstres à partir du niveau donné. */
    public function setLootable(bool $lootable, int $dropLevel = 1): static
    {
        $this->lootable = $lootable;
        $this->dropLevel = $dropLevel;

        return $this;
    }

    public function getDropLevel(): int
    {
        return $this->dropLevel;
    }

    public function getPrice(): int
    {
        return $this->price;
    }

    public function setPrice(int $price): static
    {
        $this->price = max(0, $price);

        return $this;
    }
}
