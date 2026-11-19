<?php

namespace App\Entity;

use App\Enum\EquipmentSlot;
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
}
