<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\Item;
use App\Entity\Character;
use App\Entity\LootChest;
use App\Enum\ItemCategory;
use App\Enum\Rarity;
use App\Repository\ClueRepository;
use App\Repository\ItemRepository;
use App\Repository\LootChestRepository;

/**
 * Logique de jeu exposée au client 3D : export de l'état d'une partie,
 * ramassage d'objets (avec avancement de quête) et sauvegarde de la position.
 */
final class GameStateService
{
    /**
     * Ramasser certains objets fait avancer une quête et révèle un indice.
     * code de l'objet => [code de l'étape terminée, code de l'indice découvert]
     */
    private const PICKUP_TRIGGERS = [
        'engraved_pendant' => ['examine_door_object', 'door_object'],
    ];

    public function __construct(
        private readonly ClueRepository $clueRepository,
        private readonly GameSaveSummary $summary,
        private readonly SkillBook $skillBook,
        private readonly ItemRepository $itemRepository,
        private readonly LootChestRepository $lootChestRepository,
        private readonly ShopService $shop,
    ) {
    }

    /** @return array<string, mixed> */
    public function export(GameSave $save): array
    {
        $character = $save->getCharacter();
        $class = $character?->getCharacterClass();
        $summary = $this->summary->summarize($save);

        return [
            'id' => $save->getId(),
            'slot' => $save->getSlot(),
            'zone' => $save->getZone(),
            'position' => $save->getPosition(),
            'playTimeSeconds' => $save->getPlayTimeSeconds(),
            'runes' => $save->getRunes(),
            'savedAt' => $save->getUpdatedAt()->format(\DATE_ATOM),
            'character' => [
                'name' => $character?->getName(),
                'class' => $class?->getCode(),
                'level' => $character?->getLevel(),
                'experience' => $character?->getExperience(),
                'previousLevelAt' => Character::experienceThreshold(($character?->getLevel() ?? 1) - 1),
                'nextLevelAt' => $character?->getExperienceForNextLevel(),
                'unspentStatPoints' => $character?->getUnspentStatPoints(),
                'currentHealth' => $character?->getCurrentHealth(),
                'appearance' => $character?->getAppearance(),
                'stats' => array_column($summary['stats'], 'total', 'code'),
                'maxHealth' => $this->maxHealth($save),
            ],
            'skills' => $this->skillBook->export($save),
            'chests' => array_map(fn (LootChest $chest) => $this->exportChest($chest), $save->getId() ? $this->lootChestRepository->findActiveFor($save) : []),
            'skillBar' => $this->skillBook->barFor($save),
            'inventory' => array_values(array_map(fn (InventoryItem $entry) => $this->exportInventoryItem($entry), $save->getInventoryItems()->toArray())),
            'quests' => array_map(static fn ($progress) => [
                'code' => $progress->getQuest()?->getCode(),
                'title' => $progress->getQuest()?->getTitle(),
                'main' => $progress->getQuest()?->isMain(),
                'status' => $progress->getStatus()->value,
                'currentStep' => $progress->getCurrentStep() ? [
                    'code' => $progress->getCurrentStep()->getCode(),
                    'objective' => $progress->getCurrentStep()->getObjective(),
                    'targetZone' => $progress->getCurrentStep()->getTargetZone(),
                ] : null,
            ], $summary['quests']),
            'clues' => array_values(array_map(static fn ($clue) => $clue->getCode(), $save->getDiscoveredClues()->toArray())),
        ];
    }

    /**
     * Ajoute un objet au sac (en l'empilant si possible) et applique ses éventuels effets de quête.
     *
     * @return array{item: array<string, mixed>, questAdvanced: bool, clue: ?string}
     */
    public function pickUp(GameSave $save, Item $item, int $quantity = 1): array
    {
        $quantity = max(1, $quantity);
        $entry = null;

        if ($item->isStackable()) {
            foreach ($save->getInventoryItems() as $existing) {
                if ($existing->getItem() === $item && $existing->getQuantity() < $item->getMaxStack()) {
                    $entry = $existing;
                    break;
                }
            }
        }

        if (null === $entry) {
            $entry = new InventoryItem($item, 0);
            $save->addInventoryItem($entry);
        }

        $entry->setQuantity(min($item->getMaxStack(), $entry->getQuantity() + $quantity));

        [$questAdvanced, $clueCode] = $this->applyTrigger($save, (string) $item->getCode());

        return ['item' => $this->exportInventoryItem($entry), 'questAdvanced' => $questAdvanced, 'clue' => $clueCode];
    }

    /**
     * Utilise un consommable (soin…) : applique ses effets puis retire une unité du sac.
     *
     * @return array{healed: int}
     *
     * @throws \DomainException message affichable au joueur
     */
    public function useItem(GameSave $save, InventoryItem $entry): array
    {
        $item = $entry->getItem();
        if (null === $item || ItemCategory::Consumable !== $item->getCategory()) {
            throw new \DomainException('Cet objet ne peut pas être utilisé.');
        }

        $character = $save->getCharacter();
        $healed = 0;
        $heal = (int) ($item->getEffects()['heal'] ?? 0);
        if (null !== $character && $heal > 0) {
            $before = $character->getCurrentHealth();
            $after = min($this->maxHealth($save), $before + $heal);
            if ($after <= $before) {
                throw new \DomainException('Vous êtes déjà en pleine forme.');
            }
            $character->setCurrentHealth($after);
            $healed = $after - $before;
        }

        if ($entry->getQuantity() > 1) {
            $entry->setQuantity($entry->getQuantity() - 1);
        } else {
            $save->removeInventoryItem($entry);
        }

        return ['healed' => $healed];
    }

    /**
     * Équipe l'objet (en libérant l'emplacement s'il est occupé) ou le retire s'il l'était déjà.
     *
     * @return bool vrai si l'objet est maintenant équipé
     *
     * @throws \DomainException
     */
    public function toggleEquip(GameSave $save, InventoryItem $entry): bool
    {
        if ($entry->isEquipped()) {
            $entry->setEquippedSlot(null);

            return false;
        }

        $slot = $entry->getItem()?->getEquipmentSlot();
        if (null === $slot) {
            throw new \DomainException('Cet objet ne s\'équipe pas.');
        }

        foreach ($save->getInventoryItems() as $other) {
            if ($other !== $entry && $other->getEquippedSlot() === $slot) {
                $other->setEquippedSlot(null);
            }
        }
        $entry->setEquippedSlot($slot);

        return true;
    }

    /** Santé maximale : statistique « santé » avec les bonus d'équipement. */
    public function maxHealth(GameSave $save): int
    {
        foreach ($this->summary->summarize($save)['stats'] as $stat) {
            if ('health' === $stat['code']) {
                return (int) $stat['total'];
            }
        }

        return 100;
    }

    public function saveProgress(GameSave $save, string $zone, float $x, float $y, float $z, float $rotationY, int $playedSeconds, ?int $health = null): void
    {
        $save->moveTo($zone, $x, $y, $z, $rotationY);
        if (null !== $health && null !== $save->getCharacter()) {
            $save->getCharacter()->setCurrentHealth(max(0, min($this->maxHealth($save), $health)));
        }
        $save->addPlayTime($playedSeconds);
        $save->touch(); // la date de sauvegarde change même si le joueur n'a pas bougé
    }

    /** @return array{0: bool, 1: ?string} */
    private function applyTrigger(GameSave $save, string $itemCode): array
    {
        if (!isset(self::PICKUP_TRIGGERS[$itemCode])) {
            return [false, null];
        }

        [$stepCode, $clueCode] = self::PICKUP_TRIGGERS[$itemCode];
        $advanced = false;

        foreach ($save->getQuestProgresses() as $progress) {
            if ($progress->getCurrentStep()?->getCode() === $stepCode) {
                $progress->advance();
                $advanced = true;
            }
        }

        $clue = $this->clueRepository->findOneByCode($clueCode);
        if (null !== $clue && !$save->getDiscoveredClues()->contains($clue)) {
            $save->discoverClue($clue);
        } else {
            $clueCode = null;
        }

        return [$advanced, $clueCode];
    }

    /** @return array<string, mixed> */
    private function exportInventoryItem(InventoryItem $entry): array
    {
        $item = $entry->getItem();

        return [
            'id' => $entry->getId(),
            'code' => $item?->getCode(),
            'name' => $item?->getName(),
            'category' => $item?->getCategory()->value,
            'quantity' => $entry->getQuantity(),
            'categoryLabel' => $item?->getCategory()->label(),
            'description' => $item?->getDescription(),
            'maxStack' => $item?->getMaxStack(),
            'slot' => $item?->getEquipmentSlot()?->value,
            'slotLabel' => $item?->getEquipmentSlot()?->label(),
            'equippedSlot' => $entry->getEquippedSlot()?->value,
            'rarity' => $entry->getRarity()->value,
            'rarityLabel' => $entry->getRarity()->label(),
            'rarityColor' => $entry->getRarity()->color(),
            'itemLevel' => $entry->getItemLevel(),
            'bonuses' => $entry->getEffectiveBonuses(),
            'sellPrice' => $this->shop->sellPrice($entry),
            'effects' => $item?->getEffects() ?? [],
            'model' => $item?->getModelPath(),
            'weaponKind' => $item?->getWeaponKind()?->value,
            'weaponKindLabel' => $item?->getWeaponKind()?->label(),
            'twoHanded' => $item?->isTwoHanded() ?? false,
        ];
    }

    /** @return array<string, mixed> coffre de butin prêt pour l'API */
    public function exportChest(LootChest $chest): array
    {
        $codes = array_unique(array_column($chest->getContents(), 'item'));
        $items = [];
        foreach ($codes ? $this->itemRepository->findBy(['code' => $codes]) : [] as $item) {
            $items[$item->getCode()] = $item;
        }

        $contents = [];
        foreach ($chest->getContents() as $index => $entry) {
            $item = $items[$entry['item']] ?? null;
            $rarity = Rarity::tryFrom($entry['rarity']) ?? Rarity::Common;
            $contents[] = [
                'index' => $index,
                'code' => $entry['item'],
                'name' => $item?->getName() ?? $entry['item'],
                'description' => $item?->getDescription(),
                'category' => $item?->getCategory()->value,
                'categoryLabel' => $item?->getCategory()->label(),
                'slot' => $item?->getEquipmentSlot()?->value,
                'slotLabel' => $item?->getEquipmentSlot()?->label(),
                'rarity' => $rarity->value,
                'rarityLabel' => $rarity->label(),
                'rarityColor' => $rarity->color(),
                'itemLevel' => $entry['level'],
                'bonuses' => [] !== $entry['bonuses'] ? $entry['bonuses'] : ($item?->getStatBonuses() ?? []),
                'effects' => $item?->getEffects() ?? [],
                'quantity' => $entry['quantity'],
                'value' => $item ? $this->shop->value($item, $rarity, $entry['level']) : 0,
                'model' => $item?->getModelPath(),
            ];
        }

        // Rareté la plus haute : couleur du scintillement du coffre.
        $best = Rarity::Common;
        foreach ($chest->getContents() as $entry) {
            $rarity = Rarity::tryFrom($entry['rarity']) ?? Rarity::Common;
            if ($rarity->rank() > $best->rank()) {
                $best = $rarity;
            }
        }

        return [
            'id' => $chest->getId(),
            'x' => $chest->getX(),
            'z' => $chest->getZ(),
            'monster' => $chest->getMonster()?->getName(),
            'boss' => \App\Enum\MonsterTier::Boss === $chest->getMonster()?->getTier(),
            'level' => $chest->getMonsterLevel(),
            'bestRarity' => $best->value,
            'bestColor' => $best->color(),
            'expiresAt' => $chest->getExpiresAt()->format(\DATE_ATOM),
            'contents' => $contents,
        ];
    }
}
