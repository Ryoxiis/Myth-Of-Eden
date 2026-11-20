<?php

namespace App\Entity;

use App\Enum\Rarity;
use App\Repository\MerchantOfferRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Article vendu par un marchand : un objet, sa rareté et son prix en runes.
 */
#[ORM\Entity(repositoryClass: MerchantOfferRepository::class)]
class MerchantOffer
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'offers')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Merchant $merchant = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Item $item = null;

    #[ORM\Column(length: 20, enumType: Rarity::class)]
    private Rarity $rarity = Rarity::Common;

    #[ORM\Column]
    #[Assert\Positive]
    private int $price = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position = 0;

    public function __construct(?Item $item = null, int $price = 1, Rarity $rarity = Rarity::Common)
    {
        $this->item = $item;
        $this->price = $price;
        $this->rarity = $rarity;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getMerchant(): ?Merchant
    {
        return $this->merchant;
    }

    public function setMerchant(?Merchant $merchant): static
    {
        $this->merchant = $merchant;

        return $this;
    }

    public function getItem(): ?Item
    {
        return $this->item;
    }

    public function getRarity(): Rarity
    {
        return $this->rarity;
    }

    public function getPrice(): int
    {
        return $this->price;
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
}
