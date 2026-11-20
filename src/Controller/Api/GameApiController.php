<?php

namespace App\Controller\Api;

use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\LootChest;
use App\Entity\Merchant;
use App\Repository\MerchantOfferRepository;
use App\Repository\MonsterRepository;
use App\Service\ShopService;
use App\Service\AdventureService;
use App\Repository\ItemRepository;
use App\Security\Voter\GameSaveVoter;
use App\Service\GameStateService;
use App\Service\SkillBook;
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

    /** Utilise un consommable du sac (soin…). */
    #[Route('/objets/{entry}/utiliser', name: 'api_game_use_item', requirements: ['entry' => '\d+'], methods: ['POST'])]
    public function useItem(#[MapEntity(id: 'id')] GameSave $gameSave, int $entry): JsonResponse
    {
        $inventoryItem = $this->findEntry($gameSave, $entry);
        if (null === $inventoryItem) {
            return $this->error('Cet objet n\'est pas dans votre sac.', Response::HTTP_NOT_FOUND);
        }

        try {
            $result = $this->gameState->useItem($gameSave, $inventoryItem);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage());
        }
        $this->entityManager->flush();

        return $this->json($result + ['state' => $this->gameState->export($gameSave)]);
    }

    /** Équipe l'objet, ou le retire s'il était déjà équipé. */
    #[Route('/objets/{entry}/equiper', name: 'api_game_equip_item', requirements: ['entry' => '\d+'], methods: ['POST'])]
    public function equipItem(#[MapEntity(id: 'id')] GameSave $gameSave, int $entry): JsonResponse
    {
        $inventoryItem = $this->findEntry($gameSave, $entry);
        if (null === $inventoryItem) {
            return $this->error('Cet objet n\'est pas dans votre sac.', Response::HTTP_NOT_FOUND);
        }

        try {
            $equipped = $this->gameState->toggleEquip($gameSave, $inventoryItem);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage());
        }
        $this->entityManager->flush();

        return $this->json(['equipped' => $equipped, 'state' => $this->gameState->export($gameSave)]);
    }

    /** Enregistre la barre de compétences : corps JSON {"slots": ["arcane_bolt", null, …]} (6 emplacements). */
    #[Route('/competences/barre', name: 'api_game_skill_bar', methods: ['POST'])]
    public function saveSkillBar(#[MapEntity(id: 'id')] GameSave $gameSave, Request $request, SkillBook $skillBook): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        try {
            $skillBook->assignBar($gameSave, \is_array($data['slots'] ?? null) ? $data['slots'] : []);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($exception->getMessage());
        }
        $this->entityManager->flush();

        return $this->json(['skillBar' => $gameSave->getSkillBar()]);
    }

    /**
     * Victoire sur un monstre : corps JSON {"monster": "skeleton_minion_edge", "level": 2, "position": {"x": 10, "z": -40}}.
     * Le serveur calcule l'expérience, les niveaux gagnés et tire le contenu du coffre de butin.
     */
    #[Route('/combat/victoire', name: 'api_game_victory', methods: ['POST'])]
    public function victory(#[MapEntity(id: 'id')] GameSave $gameSave, Request $request, MonsterRepository $monsterRepository, AdventureService $adventure): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $monster = $monsterRepository->findOneByCode((string) ($data['monster'] ?? ''));
        if (null === $monster) {
            return $this->error('Monstre inconnu.', Response::HTTP_NOT_FOUND);
        }
        $level = filter_var($data['level'] ?? null, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 99]]);
        $x = $data['position']['x'] ?? 0;
        $z = $data['position']['z'] ?? 0;
        if (false === $level || !is_numeric($x) || !is_numeric($z) || abs((float) $x) > 1000 || abs((float) $z) > 1000) {
            return $this->error('Données de combat invalides.');
        }

        try {
            $result = $adventure->recordVictory($gameSave, $monster, $level, (float) $x, (float) $z);
        } catch (\InvalidArgumentException $exception) {
            return $this->error($exception->getMessage());
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage(), Response::HTTP_TOO_MANY_REQUESTS);
        }
        $this->entityManager->flush();

        return $this->json([
            'experience' => $result['experience'],
            'levelsGained' => $result['levelsGained'],
            'runes' => $result['runes'],
            'chest' => $result['chest'] ? $this->gameState->exportChest($result['chest']) : null,
            'state' => $this->gameState->export($gameSave),
        ]);
    }

    /** Prend un objet du coffre {"index": 0} ou tout ce qui rentre dans le sac {"all": true}. */
    #[Route('/coffres/{chest}/prendre', name: 'api_game_chest_take', requirements: ['chest' => '\d+'], methods: ['POST'])]
    public function takeFromChest(#[MapEntity(id: 'id')] GameSave $gameSave, #[MapEntity(id: 'chest')] LootChest $chest, Request $request, AdventureService $adventure): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $index = null;
        if (empty($data['all'])) {
            $index = filter_var($data['index'] ?? null, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 50]]);
            if (false === $index) {
                return $this->error('Indiquez l\'objet à prendre ("index") ou "all": true.');
            }
        }

        try {
            $taken = $adventure->takeFromChest($gameSave, $chest, $index);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage());
        }
        $empty = $chest->isEmpty();
        $this->entityManager->flush();

        return $this->json([
            'taken' => \count($taken),
            'chest' => $empty ? null : $this->gameState->exportChest($chest),
            'state' => $this->gameState->export($gameSave),
        ]);
    }

    /** Achète un article : corps JSON {"offer": 12, "quantity": 1}. */
    #[Route('/marchands/{merchant}/acheter', name: 'api_game_shop_buy', methods: ['POST'])]
    public function buy(#[MapEntity(id: 'id')] GameSave $gameSave, #[MapEntity(mapping: ['merchant' => 'code'])] Merchant $merchant, Request $request, MerchantOfferRepository $offers, ShopService $shop): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $offer = $offers->find((int) ($data['offer'] ?? 0));
        if (null === $offer || $offer->getMerchant() !== $merchant) {
            return $this->error('Cet article n\'est pas vendu ici.', Response::HTTP_NOT_FOUND);
        }
        $quantity = filter_var($data['quantity'] ?? 1, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 99]]);
        if (false === $quantity) {
            return $this->error('Quantité invalide.');
        }

        try {
            $shop->buy($gameSave, $offer, $quantity);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage());
        }
        $this->entityManager->flush();

        return $this->json(['bought' => $offer->getItem()?->getName(), 'state' => $this->gameState->export($gameSave)]);
    }

    /** Vend une ligne du sac : corps JSON {"entry": 42, "quantity": 1}. */
    #[Route('/marchands/{merchant}/vendre', name: 'api_game_shop_sell', methods: ['POST'])]
    public function sell(#[MapEntity(id: 'id')] GameSave $gameSave, #[MapEntity(mapping: ['merchant' => 'code'])] Merchant $merchant, Request $request, ShopService $shop): JsonResponse
    {
        $data = $this->readJson($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $entry = $this->findEntry($gameSave, (int) ($data['entry'] ?? 0));
        if (null === $entry) {
            return $this->error('Cet objet n\'est pas dans votre sac.', Response::HTTP_NOT_FOUND);
        }
        $quantity = filter_var($data['quantity'] ?? 1, \FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 99]]);
        if (false === $quantity) {
            return $this->error('Quantité invalide.');
        }

        try {
            $earned = $shop->sell($gameSave, $merchant, $entry, $quantity);
        } catch (\DomainException $exception) {
            return $this->error($exception->getMessage());
        }
        $this->entityManager->flush();

        return $this->json(['earned' => $earned, 'state' => $this->gameState->export($gameSave)]);
    }

    /**
     * Sauvegarde la position : corps JSON
     * {"zone": "village", "position": {"x": 0, "y": 0, "z": 0, "rotationY": 90}, "playedSeconds": 120, "health": 80}
     * (« health » est facultatif et ramené entre 0 et la santé maximale).
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

        $health = null;
        if (\array_key_exists('health', $data)) {
            $health = filter_var($data['health'], \FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 100000]]);
            if (false === $health) {
                return $this->error('Santé invalide.');
            }
        }

        $this->gameState->saveProgress($gameSave, $zone, $coords['x'], $coords['y'], $coords['z'], $coords['rotationY'], $played, $health);
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

    /** Retrouve une ligne du sac en vérifiant qu'elle appartient bien à cette partie. */
    private function findEntry(GameSave $gameSave, int $entryId): ?InventoryItem
    {
        foreach ($gameSave->getInventoryItems() as $inventoryItem) {
            if ($inventoryItem->getId() === $entryId) {
                return $inventoryItem;
            }
        }

        return null;
    }
}
