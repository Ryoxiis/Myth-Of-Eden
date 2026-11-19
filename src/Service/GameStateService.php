<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\Item;
use App\Repository\ClueRepository;

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
            'savedAt' => $save->getUpdatedAt()->format(\DATE_ATOM),
            'character' => [
                'name' => $character?->getName(),
                'class' => $class?->getCode(),
                'level' => $character?->getLevel(),
                'experience' => $character?->getExperience(),
                'currentHealth' => $character?->getCurrentHealth(),
                'appearance' => $character?->getAppearance(),
                'stats' => array_column($summary['stats'], 'total', 'code'),
            ],
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

    public function saveProgress(GameSave $save, string $zone, float $x, float $y, float $z, float $rotationY, int $playedSeconds): void
    {
        $save->moveTo($zone, $x, $y, $z, $rotationY);
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
            'equippedSlot' => $entry->getEquippedSlot()?->value,
            'model' => $item?->getModelPath(),
        ];
    }
}
