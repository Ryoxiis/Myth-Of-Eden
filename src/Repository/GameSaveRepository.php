<?php

namespace App\Repository;

use App\Entity\GameSave;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use App\Entity\User;

/**
 * @extends ServiceEntityRepository<GameSave>
 */
class GameSaveRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GameSave::class);
    }

    /**
     * Retrouve une partie uniquement si elle appartient au joueur (évite d'accéder à la partie d'un autre).
     */
    public function findOneOwnedBy(int $id, User $owner): ?GameSave
    {
        return $this->findOneBy(['id' => $id, 'owner' => $owner]);
    }

    /** @return list<GameSave> */
    public function findForOwner(User $owner): array
    {
        return $this->createQueryBuilder('g')
            ->addSelect('c', 'cc')
            ->join('g.character', 'c')
            ->join('c.characterClass', 'cc')
            ->andWhere('g.owner = :owner')
            ->setParameter('owner', $owner)
            ->orderBy('g.slot', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
