<?php

namespace App\Repository;

use App\Entity\LootChest;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LootChest>
 */
class LootChestRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LootChest::class);
    }

    /** @return list<LootChest> coffres encore pleins et non expirés d'une partie */
    public function findActiveFor(\App\Entity\GameSave $gameSave): array
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.gameSave = :save')
            ->andWhere('c.expiresAt > :now')
            ->setParameter('save', $gameSave)
            ->setParameter('now', new \DateTimeImmutable())
            ->orderBy('c.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** Supprime les coffres expirés d'une partie. */
    public function purgeExpired(\App\Entity\GameSave $gameSave): void
    {
        $this->createQueryBuilder('c')
            ->delete()
            ->andWhere('c.gameSave = :save')
            ->andWhere('c.expiresAt <= :now')
            ->setParameter('save', $gameSave)
            ->setParameter('now', new \DateTimeImmutable())
            ->getQuery()
            ->execute();
    }
}
