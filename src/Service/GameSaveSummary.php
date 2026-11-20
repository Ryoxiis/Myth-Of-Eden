<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\QuestProgress;
use App\Enum\EquipmentSlot;

/**
 * Prépare les données affichées sur la fiche d'une partie :
 * caractéristiques avec bonus d'équipement, équipement porté, sac et journal de quêtes.
 */
final class GameSaveSummary
{
    /** Libellés des caractéristiques, dans l'ordre d'affichage. */
    public const STAT_LABELS = [
        'health' => 'Santé',
        'stamina' => 'Endurance',
        'strength' => 'Force',
        'agility' => 'Agilité',
        'stealth' => 'Discrétion',
        'magicMastery' => 'Maîtrise de la magie',
        'tracking' => 'Pistage',
    ];

    /** Libellés courts des zones du prototype. */
    public const ZONE_LABELS = [
        'village' => 'Village forestier',
        'lisiere' => 'Bois de la Lisière',
        'chemin' => 'Chemin de la forêt',
        'collines' => 'Collines rocheuses',
        'sombrebois' => 'Sombrebois',
        'ruine' => 'Ruine oubliée',
        // anciens codes (parties créées avant le monde ouvert)
        'forest_path' => 'Chemin de la forêt',
        'ruin' => 'Ruine oubliée',
    ];

    /**
     * @return array{
     *     stats: list<array{code: string, label: string, base: int, bonus: int, total: int}>,
     *     equipment: list<array{slot: EquipmentSlot, item: InventoryItem|null}>,
     *     bag: list<InventoryItem>,
     *     quests: list<QuestProgress>,
     *     zoneLabel: string,
     * }
     */
    public function summarize(GameSave $gameSave): array
    {
        $character = $gameSave->getCharacter();
        $baseStats = $character?->getStats()->toArray() ?? [];

        $equippedBySlot = [];
        $bag = [];
        $bonuses = array_fill_keys(array_keys(self::STAT_LABELS), 0);

        foreach ($gameSave->getInventoryItems() as $inventoryItem) {
            $slot = $inventoryItem->getEquippedSlot();

            if (null === $slot) {
                $bag[] = $inventoryItem;
                continue;
            }

            $equippedBySlot[$slot->value] = $inventoryItem;

            foreach ($inventoryItem->getEffectiveBonuses() as $stat => $value) {
                if (\array_key_exists($stat, $bonuses)) {
                    $bonuses[$stat] += (int) $value;
                }
            }
        }

        $stats = [];
        foreach (self::STAT_LABELS as $code => $label) {
            $base = (int) ($baseStats[$code] ?? 0);
            $stats[] = [
                'code' => $code,
                'label' => $label,
                'base' => $base,
                'bonus' => $bonuses[$code],
                'total' => $base + $bonuses[$code],
            ];
        }

        $equipment = [];
        foreach (EquipmentSlot::cases() as $slot) {
            $equipment[] = ['slot' => $slot, 'item' => $equippedBySlot[$slot->value] ?? null];
        }

        // Quête principale d'abord, puis les quêtes en cours avant les quêtes terminées.
        $quests = $gameSave->getQuestProgresses()->toArray();
        usort($quests, static fn (QuestProgress $a, QuestProgress $b): int => [
            $b->getQuest()?->isMain() ? 1 : 0,
            $a->isCompleted() ? 1 : 0,
        ] <=> [
            $a->getQuest()?->isMain() ? 1 : 0,
            $b->isCompleted() ? 1 : 0,
        ]);

        return [
            'stats' => $stats,
            'equipment' => $equipment,
            'bag' => $bag,
            'quests' => array_values($quests),
            'zoneLabel' => self::ZONE_LABELS[$gameSave->getZone()] ?? $gameSave->getZone(),
        ];
    }
}
