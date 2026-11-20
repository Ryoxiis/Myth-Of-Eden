<?php

namespace App\Service;

use App\Content\NpcCatalog;
use App\Entity\Clue;
use App\Entity\Npc;
use App\Entity\Zone;
use App\Repository\ClueRepository;
use App\Repository\NpcRepository;
use App\Repository\ZoneRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Crée ou met à jour les PNJ du catalogue, sans toucher au reste de la base
 * (comptes, parties…) : utile sur le site en ligne, où l'on ne recharge pas les fixtures.
 */
final class NpcInstaller
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly NpcRepository $npcs,
        private readonly ZoneRepository $zones,
        private readonly ClueRepository $clues,
    ) {
    }

    /**
     * @param array<string, Zone> $zones déjà chargées (fixtures), sinon lues en base
     * @param array<string, Clue> $clues idem
     *
     * @return list<string> codes des PNJ créés ou mis à jour
     */
    public function install(array $zones = [], array $clues = []): array
    {
        $done = [];
        foreach (NpcCatalog::all() as $data) {
            $zone = $zones[$data['zone']] ?? $this->zones->findOneBy(['code' => $data['zone']]);
            if (null === $zone) {
                continue; // zone absente : rien à placer
            }
            $clue = null === $data['clue'] ? null : ($clues[$data['clue']] ?? $this->clues->findOneByCode($data['clue']));

            $npc = $this->npcs->findOneBy(['code' => $data['code']]) ?? (new Npc())->setCode($data['code']);
            $npc->setName($data['name'])->setTitle($data['title'])->setZone($zone)
                ->setPosition($data['x'], $data['z'], $data['rotation'])
                ->setModel($data['model'])->setTint($data['tint'])
                ->setQuestStep($data['questStep'], $clue)
                ->setQuestDialogue($data['questDialogue'])
                ->setIdleDialogue($data['idleDialogue']);
            $this->entityManager->persist($npc);
            $done[] = $data['code'];
        }

        return $done;
    }
}
