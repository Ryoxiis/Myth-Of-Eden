<?php

namespace App\Repository;

use App\Entity\CharacterClass;
use App\Entity\Skill;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Skill>
 */
class SkillRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Skill::class);
    }

    public function findOneByCode(string $code): ?Skill
    {
        return $this->findOneBy(['code' => $code]);
    }

    /**
     * Toutes les compétences d'une classe, dans l'ordre du grimoire (niveau requis puis position).
     *
     * @return list<Skill>
     */
    public function findForClass(CharacterClass $characterClass): array
    {
        return $this->createQueryBuilder('s')
            ->andWhere('s.characterClass = :class')
            ->setParameter('class', $characterClass)
            ->orderBy('s.requiredLevel', 'ASC')
            ->addOrderBy('s.position', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
