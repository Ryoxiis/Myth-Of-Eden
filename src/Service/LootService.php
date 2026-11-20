<?php

namespace App\Service;

use App\Entity\Item;
use App\Entity\Monster;
use App\Enum\ItemCategory;
use App\Enum\Rarity;
use App\Repository\ItemRepository;
use Random\Randomizer;

/**
 * Tirage du butin (RNG). Le serveur seul décide de ce qui tombe : le client ne fait qu'afficher.
 *
 * - Le rang du monstre (normal, élite, boss) fixe le nombre d'objets.
 * - La rareté est tirée au poids ; le niveau et le rang du monstre ajoutent de la « chance »
 *   qui favorise les raretés hautes : un boss de haut niveau donne bien plus souvent du légendaire.
 * - Les statistiques grandissent avec la rareté et le niveau, et les raretés hautes gagnent des bonus en plus.
 */
final class LootService
{
    /** Caractéristiques possibles pour les bonus supplémentaires. */
    private const AFFIX_STATS = ['health', 'stamina', 'strength', 'agility', 'stealth', 'magicMastery', 'tracking'];

    /** Consommables qui peuvent accompagner le butin : code => quantité max. */
    private const SUPPLIES = ['apple' => 3, 'bandage' => 2];

    private Randomizer $random;

    public function __construct(private readonly ItemRepository $itemRepository, ?Randomizer $random = null)
    {
        $this->random = $random ?? new Randomizer();
    }

    /** Chance du tirage : grandit avec le niveau et le rang du monstre. */
    public function luck(Monster $monster, int $level): float
    {
        return max(0, ($level - 1) * 0.06) + $monster->getTier()->luck();
    }

    /**
     * Probabilité de chaque rareté (pour l'affichage ou les tests).
     *
     * @return array<string, float> code de rareté => probabilité (somme = 1)
     */
    public function rarityOdds(Monster $monster, int $level): array
    {
        $weights = $this->rarityWeights($this->luck($monster, $level));
        $total = array_sum($weights);

        return array_map(static fn (float $weight) => $weight / $total, $weights);
    }

    public function rollRarity(Monster $monster, int $level): Rarity
    {
        $weights = $this->rarityWeights($this->luck($monster, $level));
        $pick = $this->random->getFloat(0, array_sum($weights));
        foreach ($weights as $code => $weight) {
            $pick -= $weight;
            if ($pick <= 0) {
                return Rarity::from($code);
            }
        }

        return Rarity::Common;
    }

    /**
     * Contenu d'un coffre pour un monstre vaincu.
     *
     * @return list<array{item: string, rarity: string, level: int, bonuses: array<string, int>, quantity: int}>
     */
    public function rollChest(Monster $monster, int $level): array
    {
        [$guaranteed, $extraChance] = $monster->getTier()->dropRolls();
        $count = $guaranteed + ($this->chance($extraChance) ? 1 : 0);

        $pool = array_values(array_filter(
            $this->itemRepository->findBy(['lootable' => true]),
            static fn (Item $item) => $item->getDropLevel() <= $level && null !== $item->getEquipmentSlot(),
        ));

        $contents = [];
        for ($i = 0; $i < $count && [] !== $pool; ++$i) {
            $item = $pool[$this->random->getInt(0, \count($pool) - 1)];
            $rarity = $this->rollRarity($monster, $level);
            $contents[] = [
                'item' => (string) $item->getCode(),
                'rarity' => $rarity->value,
                'level' => $level,
                'bonuses' => $this->rollBonuses($item, $rarity, $level),
                'quantity' => 1,
            ];
        }

        if ($this->chance(0.35)) {
            $code = array_keys(self::SUPPLIES)[$this->random->getInt(0, \count(self::SUPPLIES) - 1)];
            $contents[] = ['item' => $code, 'rarity' => Rarity::Common->value, 'level' => 1, 'bonuses' => [], 'quantity' => $this->random->getInt(1, self::SUPPLIES[$code])];
        }

        return $contents;
    }

    /** @return array<string, int> */
    public function rollBonuses(Item $item, Rarity $rarity, int $level): array
    {
        $scale = $rarity->statMultiplier() * (1 + ($level - 1) * 0.12);
        $bonuses = [];
        foreach ($item->getStatBonuses() as $stat => $value) {
            $bonuses[$stat] = max(1, (int) round($value * $scale));
        }
        for ($i = 0; $i < $rarity->extraAffixes(); ++$i) {
            $stat = self::AFFIX_STATS[$this->random->getInt(0, \count(self::AFFIX_STATS) - 1)];
            $amount = (int) round($this->random->getInt(1, 3) * $scale * (\in_array($stat, ['health', 'stamina'], true) ? 3 : 1));
            $bonuses[$stat] = ($bonuses[$stat] ?? 0) + max(1, $amount);
        }

        return $bonuses;
    }

    /** @return array<string, float> */
    private function rarityWeights(float $luck): array
    {
        $weights = [];
        foreach (Rarity::cases() as $rarity) {
            $weights[$rarity->value] = $rarity->baseWeight() * (1 + $luck) ** ($rarity->rank() * 0.8);
        }

        return $weights;
    }

    private function chance(float $probability): bool
    {
        return $this->random->getFloat(0, 1) < $probability;
    }
}
