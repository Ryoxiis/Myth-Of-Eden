<?php

namespace App\Entity;

use App\Enum\EquipmentSlot;
use App\Enum\Rarity;
use App\Repository\InventoryItemRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Exemplaire(s) d'un objet dans le sac d'une partie, éventuellement équipé.
 */
#[ORM\Entity(repositoryClass: InventoryItemRepository::class)]
class InventoryItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'inventoryItems')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?GameSave $gameSave = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Item $item = null;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $quantity = 1;

    /** Emplacement où l'objet est équipé, ou null s'il est simplement dans le sac. */
    #[ORM\Column(nullable: true, enumType: EquipmentSlot::class)]
    private ?EquipmentSlot $equippedSlot = null;

    /** Rareté de cet exemplaire (les objets trouvés sur les monstres peuvent être rares). */
    #[ORM\Column(length: 20, enumType: Rarity::class, options: ['default' => 'common'])]
    private Rarity $rarity = Rarity::Common;

    /** Niveau de l'objet (celui du monstre qui l'a laissé). */
    #[ORM\Column(type: Types::SMALLINT, options: ['default' => 1])]
    private int $itemLevel = 1;

    /**
     * Bonus tirés au moment du butin ; null = bonus de base de l'objet.
     *
     * @var array<string, int>|null
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $rolledBonuses = null;

    public function __construct(?Item $item = null, int $quantity = 1)
    {
        $this->item = $item;
        $this->quantity = $quantity;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGameSave(): ?GameSave
    {
        return $this->gameSave;
    }

    public function setGameSave(?GameSave $gameSave): static
    {
        $this->gameSave = $gameSave;

        return $this;
    }

    public function getItem(): ?Item
    {
        return $this->item;
    }

    public function setItem(Item $item): static
    {
        $this->item = $item;

        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static
    {
        $this->quantity = $quantity;

        return $this;
    }

    public function getEquippedSlot(): ?EquipmentSlot
    {
        return $this->equippedSlot;
    }

    public function setEquippedSlot(?EquipmentSlot $equippedSlot): static
    {
        $this->equippedSlot = $equippedSlot;

        return $this;
    }

    public function isEquipped(): bool
    {
        return null !== $this->equippedSlot;
    }

    public function getRarity(): Rarity
    {
        return $this->rarity;
    }

    public function setRarity(Rarity $rarity): static
    {
        $this->rarity = $rarity;

        return $this;
    }

    public function getItemLevel(): int
    {
        return $this->itemLevel;
    }

    public function setItemLevel(int $itemLevel): static
    {
        $this->itemLevel = max(1, $itemLevel);

        return $this;
    }

    /** @param array<string, int>|null $rolledBonuses */
    public function setRolledBonuses(?array $rolledBonuses): static
    {
        $this->rolledBonuses = $rolledBonuses;

        return $this;
    }

    /**
     * Bonus réellement appliqués quand l'objet est équipé.
     *
     * @return array<string, int>
     */
    public function getEffectiveBonuses(): array
    {
        return $this->rolledBonuses ?? $this->item?->getStatBonuses() ?? [];
    }

    /** Deux lignes peuvent s'empiler si c'est le même objet, de même rareté et sans bonus propres. */
    public function canStackWith(Item $item, Rarity $rarity): bool
    {
        return $this->item === $item && $this->rarity === $rarity && null === $this->rolledBonuses && !$this->isEquipped();
    }
}
