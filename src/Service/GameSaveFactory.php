<?php

namespace App\Service;

use App\Entity\Character;
use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\Item;
use App\Entity\QuestProgress;
use App\Entity\User;
use App\Form\Model\NewCharacterData;
use App\Repository\ItemRepository;
use App\Repository\QuestRepository;

/**
 * Crée une nouvelle partie prête à jouer : personnage, position de départ,
 * quête principale lancée et équipement de départ selon la classe.
 */
final class GameSaveFactory
{
    public const START_ZONE = 'village';
    public const MAIN_QUEST_CODE = 'light_in_the_forest';

    /** Arme de départ, équipée, selon le code de la classe. */
    private const STARTING_WEAPONS = [
        'scout' => 'hunting_bow',
        'fighter' => 'short_sword',
        'traveler' => 'short_sword',
        'mage' => 'oak_staff',
    ];

    /** Provisions de départ communes à toutes les classes : code de l'objet => quantité. */
    private const STARTING_SUPPLIES = [
        'apple' => 3,
        'bandage' => 2,
    ];

    public function __construct(
        private readonly ItemRepository $itemRepository,
        private readonly QuestRepository $questRepository,
        private readonly SkillBook $skillBook,
    ) {
    }

    public function create(User $owner, int $slot, NewCharacterData $data): GameSave
    {
        if (null === $data->characterClass) {
            throw new \InvalidArgumentException('Une classe est nécessaire pour créer un personnage.');
        }

        $character = (new Character())
            ->setName((string) $data->name)
            ->setAppearance($data->getAppearance())
            ->applyClass($data->characterClass);

        $gameSave = (new GameSave())
            ->setSlot($slot)
            ->setCharacter($character)
            ->moveTo(self::START_ZONE, 0.0, 0.0, 0.0);

        $owner->addGameSave($gameSave);

        $this->addStartingItems($gameSave, (string) $data->characterClass->getCode());
        $this->startMainQuest($gameSave);
        // Barre de départ : les compétences du niveau 1 de la classe.
        $gameSave->setSkillBar($this->skillBook->defaultBar($gameSave));

        return $gameSave;
    }

    private function addStartingItems(GameSave $gameSave, string $classCode): void
    {
        $weaponCode = self::STARTING_WEAPONS[$classCode] ?? null;
        $weapon = null !== $weaponCode ? $this->itemRepository->findOneByCode($weaponCode) : null;

        if ($weapon instanceof Item) {
            $gameSave->addInventoryItem(
                (new InventoryItem($weapon))->setEquippedSlot($weapon->getEquipmentSlot())
            );
        }

        foreach (self::STARTING_SUPPLIES as $code => $quantity) {
            $item = $this->itemRepository->findOneByCode($code);

            if ($item instanceof Item) {
                $gameSave->addInventoryItem(new InventoryItem($item, min($quantity, $item->getMaxStack())));
            }
        }
    }

    private function startMainQuest(GameSave $gameSave): void
    {
        $quest = $this->questRepository->findOneByCode(self::MAIN_QUEST_CODE);

        if (null !== $quest) {
            $gameSave->addQuestProgress(new QuestProgress($quest));
        }
    }
}
