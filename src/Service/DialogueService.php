<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\Npc;

/**
 * Conversations avec les PNJ : choisit les répliques et fait avancer la quête quand il le faut.
 */
final class DialogueService
{
    /** Distance maximale (en mètres) entre le joueur et le PNJ pour lui parler. */
    public const TALK_DISTANCE = 6.0;

    /**
     * @return array{lines: list<string>, questAdvanced: bool, clue: ?string}
     *
     * @param float $x position du joueur envoyée par le client 3D
     * @param float $z
     *
     * @throws \InvalidArgumentException si le joueur est trop loin du PNJ
     */
    public function talk(GameSave $save, Npc $npc, float $x, float $z): array
    {
        $distance = hypot($x - $npc->getX(), $z - $npc->getZ());
        if ($distance > self::TALK_DISTANCE) {
            throw new \InvalidArgumentException(sprintf('%s est trop loin pour vous entendre.', $npc->getName()));
        }

        $stepCode = $npc->getQuestStepCode();
        if (null !== $stepCode) {
            foreach ($save->getQuestProgresses() as $progress) {
                if ($progress->getCurrentStep()?->getCode() !== $stepCode) {
                    continue;
                }

                $progress->advance();
                $clue = $npc->getClue();
                $clueCode = null;
                if (null !== $clue && !$save->getDiscoveredClues()->contains($clue)) {
                    $save->discoverClue($clue);
                    $clueCode = $clue->getCode();
                }

                return ['lines' => $npc->getQuestDialogue(), 'questAdvanced' => true, 'clue' => $clueCode];
            }
        }

        return ['lines' => $npc->getIdleDialogue(), 'questAdvanced' => false, 'clue' => null];
    }
}
