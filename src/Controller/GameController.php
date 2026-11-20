<?php

namespace App\Controller;

use App\Entity\GameSave;
use App\Security\Voter\GameSaveVoter;
use App\Service\GameSaveSummary;
use Symfony\Bridge\Doctrine\Attribute\MapEntity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Page du jeu 3D : elle ne fait qu'afficher le canvas Babylon.js.
 * Tout l'état de la partie passe ensuite par l'API JSON (Api\GameApiController).
 */
#[IsGranted('ROLE_USER')]
final class GameController extends AbstractController
{
    #[Route('/jouer/{id}', name: 'app_game_play', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted(GameSaveVoter::MANAGE, 'gameSave')]
    public function play(#[MapEntity(id: 'id')] GameSave $gameSave): Response
    {
        $character = $gameSave->getCharacter();

        return $this->render('game/play.html.twig', [
            'save' => $gameSave,
            'character' => $character,
            'classCode' => $character?->getCharacterClass()?->getCode() ?? 'traveler',
            'zoneLabel' => GameSaveSummary::ZONE_LABELS['village'],
        ]);
    }
}
