<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\LootChest;
use App\Entity\Monster;
use App\Enum\Rarity;
use App\Repository\ItemRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Aventure dans le monde ouvert : victoires sur les monstres (expérience, niveaux, coffre de butin)
 * et récupération du contenu des coffres.
 */
final class AdventureService
{
    /** Délai minimal entre deux victoires enregistrées (anti-triche simple). */
    private const MIN_DELAY_MS = 600;

    /** Progression des caractéristiques à chaque niveau, selon la classe. */
    private const CLASS_GROWTH = [
        'scout' => ['agility' => 1, 'tracking' => 1],
        'fighter' => ['strength' => 1, 'health' => 4],
        'traveler' => ['strength' => 1, 'stamina' => 3],
        'mage' => ['magicMastery' => 1, 'stamina' => 2],
    ];

    public function __construct(
        private readonly LootService $loot,
        private readonly ItemRepository $itemRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Enregistre une victoire et crée le coffre de butin s'il y a quelque chose à prendre.
     *
     * @return array{experience: int, levelsGained: int, runes: int, chest: ?LootChest}
     *
     * @throws \InvalidArgumentException données incohérentes
     * @throws \DomainException          victoires trop rapprochées
     */
    public function recordVictory(GameSave $save, Monster $monster, int $level, float $x, float $z): array
    {
        if ($level < $monster->minLevel() || $level > $monster->maxLevel()) {
            throw new \InvalidArgumentException('Niveau de monstre impossible dans cette zone.');
        }

        $now = new \DateTimeImmutable();
        $last = $save->getLastVictoryAt();
        if (null !== $last && ((float) $now->format('U.u') - (float) $last->format('U.u')) * 1000 < self::MIN_DELAY_MS) {
            throw new \DomainException('Doucement ! Une victoire à la fois.');
        }
        $save->setLastVictoryAt($now);

        $character = $save->getCharacter();
        $experience = $monster->experienceAt($level);
        $levels = $character?->gainExperience($experience, self::CLASS_GROWTH[$character->getCharacterClass()?->getCode()] ?? []) ?? 0;

        // Runes : selon le niveau et le rang du monstre, avec un peu de hasard.
        $runes = (int) round((3 + $level * 2.5) * $monster->getTier()->runeMultiplier() * (0.8 + mt_rand(0, 40) / 100));
        $save->addRunes($runes);

        $chest = null;
        $contents = $this->loot->rollChest($monster, $level);
        if ([] !== $contents) {
            $chest = (new LootChest($save, $monster, $level, $x, $z))->setContents($contents);
            $this->entityManager->persist($chest);
        }

        return ['experience' => $experience, 'levelsGained' => $levels, 'runes' => $runes, 'chest' => $chest];
    }

    /**
     * Prend un objet du coffre (index) ou tout ce qui rentre dans le sac (index null).
     *
     * @return list<array<string, mixed>> objets récupérés (format du coffre)
     *
     * @throws \DomainException
     */
    public function takeFromChest(GameSave $save, LootChest $chest, ?int $index): array
    {
        if ($chest->getGameSave() !== $save) {
            throw new \DomainException('Ce coffre ne vous appartient pas.');
        }
        if ($chest->isExpired()) {
            throw new \DomainException('Le coffre s\'est évanoui…');
        }

        $indexes = null === $index ? array_keys($chest->getContents()) : [$index];
        if (null !== $index && !isset($chest->getContents()[$index])) {
            throw new \DomainException('Cet objet n\'est plus dans le coffre.');
        }

        $taken = [];
        // On prend du dernier au premier pour que les index restent valides.
        foreach (array_reverse($indexes) as $i) {
            $entry = $chest->getContents()[$i];
            if (!$this->addToBag($save, $entry)) {
                if (null !== $index) {
                    throw new \DomainException('Votre sac est plein.');
                }
                continue;
            }
            $chest->take($i);
            $taken[] = $entry;
        }

        if ($chest->isEmpty()) {
            $this->entityManager->remove($chest);
        }

        return array_reverse($taken);
    }

    /** @param array{item: string, rarity: string, level: int, bonuses: array<string, int>, quantity: int} $entry */
    private function addToBag(GameSave $save, array $entry): bool
    {
        $item = $this->itemRepository->findOneByCode($entry['item']);
        if (null === $item) {
            return true; // objet supprimé du jeu : on le retire simplement du coffre
        }
        $rarity = Rarity::tryFrom($entry['rarity']) ?? Rarity::Common;

        if ($item->isStackable() && [] === $entry['bonuses']) {
            foreach ($save->getInventoryItems() as $existing) {
                if ($existing->canStackWith($item, $rarity) && $existing->getQuantity() < $item->getMaxStack()) {
                    $existing->setQuantity(min($item->getMaxStack(), $existing->getQuantity() + $entry['quantity']));

                    return true;
                }
            }
        }

        if ($save->countBagEntries() >= GameSave::BAG_SIZE) {
            return false;
        }

        $save->addInventoryItem((new InventoryItem($item, max(1, $entry['quantity'])))
            ->setRarity($rarity)
            ->setItemLevel($entry['level'])
            ->setRolledBonuses([] === $entry['bonuses'] ? null : $entry['bonuses']));

        return true;
    }
}
