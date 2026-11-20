<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\Item;
use App\Entity\Merchant;
use App\Entity\MerchantOffer;
use App\Enum\ItemCategory;
use App\Enum\Rarity;

/**
 * Commerce avec les marchands : achat d'objets contre des runes, revente du butin.
 *
 * Valeur d'un objet = prix de base × multiplicateur de rareté × (1 + 15 % par niveau au-delà du premier).
 * Le marchand rachète une part de cette valeur (taux propre à chaque marchand).
 */
final class ShopService
{
    public function value(Item $item, Rarity $rarity, int $level): int
    {
        return (int) round(max(1, $item->getPrice()) * $rarity->priceMultiplier() * (1 + max(0, $level - 1) * 0.15));
    }

    /** Prix de rachat d'une unité ; 0 = invendable (objet de quête). */
    public function sellPrice(InventoryItem $entry, float $buybackRate = 0.25): int
    {
        $item = $entry->getItem();
        if (null === $item || ItemCategory::Quest === $item->getCategory()) {
            return 0;
        }

        return max(1, (int) floor($this->value($item, $entry->getRarity(), $entry->getItemLevel()) * $buybackRate));
    }

    /**
     * @throws \DomainException message affichable
     */
    public function buy(GameSave $save, MerchantOffer $offer, int $quantity = 1): void
    {
        $item = $offer->getItem();
        $quantity = max(1, min($quantity, $item?->isStackable() ? $item->getMaxStack() : 1));
        $total = $offer->getPrice() * $quantity;

        if (null === $item) {
            throw new \DomainException('Cet article n\'existe plus.');
        }
        if ($save->getRunes() < $total) {
            throw new \DomainException(\sprintf('Il vous manque %d runes.', $total - $save->getRunes()));
        }

        // Empilement sur une pile existante si possible, sinon nouvelle case du sac.
        $stack = null;
        if ($item->isStackable()) {
            foreach ($save->getInventoryItems() as $existing) {
                if ($existing->canStackWith($item, $offer->getRarity()) && $existing->getQuantity() + $quantity <= $item->getMaxStack()) {
                    $stack = $existing;
                    break;
                }
            }
        }
        if (null === $stack && $save->countBagEntries() >= GameSave::BAG_SIZE) {
            throw new \DomainException('Votre sac est plein.');
        }

        $save->spendRunes($total);
        if (null !== $stack) {
            $stack->setQuantity($stack->getQuantity() + $quantity);
        } else {
            $save->addInventoryItem((new InventoryItem($item, $quantity))->setRarity($offer->getRarity()));
        }
    }

    /**
     * Vend une ou plusieurs unités d'une ligne du sac.
     *
     * @return int runes gagnées
     *
     * @throws \DomainException
     */
    public function sell(GameSave $save, Merchant $merchant, InventoryItem $entry, int $quantity = 1): int
    {
        if ($entry->isEquipped()) {
            throw new \DomainException('Retirez d\'abord cet objet avant de le vendre.');
        }
        $unit = $this->sellPrice($entry, $merchant->getBuybackRate());
        if (0 === $unit) {
            throw new \DomainException('Le marchand ne veut pas de cet objet.');
        }

        $quantity = max(1, min($quantity, $entry->getQuantity()));
        $earned = $unit * $quantity;
        if ($quantity >= $entry->getQuantity()) {
            $save->removeInventoryItem($entry);
        } else {
            $entry->setQuantity($entry->getQuantity() - $quantity);
        }
        $save->addRunes($earned);

        return $earned;
    }
}
