<?php

namespace App\Controller\Api;

use App\Entity\GameSave;
use App\Repository\ItemRepository;
use App\Security\Voter\GameSaveVoter;
use App\Service\GameStateService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Attribute\MapEntity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * API JSON utilisée par le client 3D. Le joueur est identifié par sa session (même connexion que le site)
 * et ne peut agir que sur ses propres parties (GameSaveVoter).
 */
#[Route('/api/parties/{id}', requirements: ['id' => '\d+'])]
#[IsGranted(GameSaveVoter::MANAGE, 'gameSave')]
final class GameApiController extends AbstractController
{
    public function __construct(
        private readonly GameStateService $gameState,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /** Charge l'état complet de la partie au démarrage du jeu. */
    #[Route('', name: 'api_game_load', methods: ['GET'])]
    public function load(#[MapEntity(id: 'id')] GameSave $gameSave): JsonResponse
    {
        return $this->json($this->gameState->export($gameSave));
    }

    /** Ramasse un objet : corps JSON {"item": "engraved_pendant", "quantity": 1}. */
    #[Route('/objets/ramasser', name: 'api_game_pick_up', methods: ['POST'])]
    public function pickUp(#[MapEntity(id: 'id')] GameSave $gameSave, Request $request, ItemRepository $itemRepository): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $item = $itemRepository->findOneByCode((string) ($data['item'] ?? ''));
        if (null === $item) {
            return $this->error('Objet inconnu.', Response::HTTP_NOT_FOUND);
        }

        $quantity = filter_var($data['quantity'] ?? 1, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 99]]);
        if (false === $quantity) {
            return $this->error('Quantité invalide (1 à 99).');
        }

        $result = $this->gameState->pickUp($gameSave, $item, $quantity);
        $this->entityManager->flush();

        return $this->json($result + ['state' => $this->gameState->export($gameSave)]);
    }

    /**
     * Sauvegarde la position : corps JSON
     * {"zone": "village", "position": {"x": 0, "y": 0, "z": 0, "rotationY": 90}, "playedSeconds": 120}.
     */
    #[Route('/sauvegarde', name: 'api_game_save', methods: ['POST'])]
    public function save(#[MapEntity(id: 'id')] GameSave $gameSave, Request $request): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $zone = (string) ($data['zone'] ?? '');
        if (!preg_match('/^[a-z0-9_]{2,80}$/', $zone)) {
            return $this->error('Zone invalide.');
        }

        $position = \is_array($data['position'] ?? null) ? $data['position'] : [];
        $coords = [];
        foreach (['x', 'y', 'z', 'rotationY'] as $axis) {
            $value = $position[$axis] ?? 0;
            if (!is_numeric($value) || !is_finite((float) $value) || abs((float) $value) > 100000) {
                return $this->error(sprintf('Coordonnée « %s » invalide.', $axis));
            }
            $coords[$axis] = (float) $value;
        }

        $played = filter_var($data['playedSeconds'] ?? 0, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 3600]]);
        if (false === $played) {
            return $this->error('Temps de jeu invalide (0 à 3600 secondes par sauvegarde).');
        }

        $this->gameState->saveProgress($gameSave, $zone, $coords['x'], $coords['y'], $coords['z'], $coords['rotationY'], $played);
        $this->entityManager->flush();

        return $this->json(['saved' => true, 'savedAt' => $gameSave->getUpdatedAt()->format(\DATE_ATOM)]);
    }

    /** @return array<string, mixed>|JsonResponse */
    private function readJson(Request $request): array|JsonResponse
    {
        try {
            return $request->toArray();
        } catch (\Throwable) {
            return $this->error('Le corps de la requête doit être du JSON valide.', Response::HTTP_BAD_REQUEST);
        }
    }

    private function error(string $message, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return $this->json(['error' => $message], $status);
    }
}
