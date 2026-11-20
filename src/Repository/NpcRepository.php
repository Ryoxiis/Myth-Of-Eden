<?php

namespace App\Repository;

use App\Entity\Npc;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Npc>
 */
class NpcRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Npc::class);
    }

    /** @return list<Npc> PNJ avec leur zone, dans l'ordre de création. */
    public function findAllWithZone(): array
    {
        return $this->createQueryBuilder('n')
            ->addSelect('z')
            ->join('n.zone', 'z')
            ->orderBy('n.id', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
