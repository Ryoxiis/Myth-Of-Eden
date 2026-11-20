<?php

namespace App\Controller\Api;

use App\Entity\Monster;
use App\Entity\Zone;
use App\Enum\Rarity;
use App\Entity\Merchant;
use App\Entity\MerchantOffer;
use App\Repository\MerchantRepository;
use App\Repository\ZoneRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Données du monde communes à toutes les parties : zones, monstres et raretés.
 */
#[IsGranted('ROLE_USER')]
final class WorldApiController extends AbstractController
{
    #[Route('/api/monde', name: 'api_world', methods: ['GET'])]
    public function world(ZoneRepository $zoneRepository, MerchantRepository $merchantRepository): JsonResponse
    {
        $response = $this->json([
            'zones' => array_map(static fn (Zone $zone) => [
                'code' => $zone->getCode(),
                'name' => $zone->getName(),
                'description' => $zone->getDescription(),
                'minLevel' => $zone->getMinLevel(),
                'maxLevel' => $zone->getMaxLevel(),
                'safe' => $zone->isSafe(),
                'monsters' => array_map(static fn (Monster $monster) => [
                    'code' => $monster->getCode(),
                    'name' => $monster->getName(),
                    'tier' => $monster->getTier()->value,
                    'tierLabel' => $monster->getTier()->label(),
                    'model' => $monster->getModel(),
                    'weapon' => $monster->getWeapon(),
                    'tint' => $monster->getTint(),
                    'scale' => $monster->getScale(),
                    'health' => $monster->getBaseHealth(),
                    'damage' => $monster->getBaseDamage(),
                    'attackRange' => $monster->getAttackRange(),
                    'speed' => $monster->getSpeed(),
                    'population' => $monster->getPopulation(),
                    'minLevel' => $monster->minLevel(),
                    'maxLevel' => $monster->maxLevel(),
                ], $zone->getMonsters()->toArray()),
            ], $zoneRepository->findAllWithMonsters()),
            'merchants' => array_map(static fn (Merchant $merchant) => [
                'code' => $merchant->getCode(),
                'name' => $merchant->getName(),
                'greeting' => $merchant->getGreeting(),
                'zone' => $merchant->getZone()?->getCode(),
                'x' => $merchant->getX(),
                'z' => $merchant->getZ(),
                'buybackRate' => $merchant->getBuybackRate(),
                'offers' => array_map(static fn (MerchantOffer $offer) => [
                    'id' => $offer->getId(),
                    'code' => $offer->getItem()?->getCode(),
                    'name' => $offer->getItem()?->getName(),
                    'description' => $offer->getItem()?->getDescription(),
                    'category' => $offer->getItem()?->getCategory()->value,
                    'categoryLabel' => $offer->getItem()?->getCategory()->label(),
                    'slot' => $offer->getItem()?->getEquipmentSlot()?->value,
                    'slotLabel' => $offer->getItem()?->getEquipmentSlot()?->label(),
                    'stackable' => $offer->getItem()?->isStackable(),
                    'rarity' => $offer->getRarity()->value,
                    'rarityLabel' => $offer->getRarity()->label(),
                    'rarityColor' => $offer->getRarity()->color(),
                    'bonuses' => $offer->getItem()?->getStatBonuses() ?? [],
                    'effects' => $offer->getItem()?->getEffects() ?? [],
                    'price' => $offer->getPrice(),
                ], $merchant->getOffers()->toArray()),
            ], $merchantRepository->findAll()),
            'rarities' => array_map(static fn (Rarity $rarity) => [
                'code' => $rarity->value,
                'label' => $rarity->label(),
                'color' => $rarity->color(),
                'rank' => $rarity->rank(),
            ], Rarity::cases()),
        ]);
        return $response;
    }
}
