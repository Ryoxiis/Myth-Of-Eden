<?php

namespace App\Entity;

use App\Repository\ZoneRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Région du monde ouvert avec sa tranche de niveaux. Le tracé exact de la zone est défini
 * par le client 3D (même code) ; Symfony garde les règles : niveaux et monstres autorisés.
 */
#[ORM\Entity(repositoryClass: ZoneRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_ZONE_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
#[Assert\Expression('this.getMinLevel() <= this.getMaxLevel()', message: 'Le niveau minimal doit être inférieur au niveau maximal.')]
class Zone
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    private string $description = '';

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $minLevel = 1;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $maxLevel = 1;

    /** Zone sûre : aucun monstre n'y apparaît (village). */
    #[ORM\Column]
    private bool $safe = false;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position = 0;

    /** @var Collection<int, Monster> */
    #[ORM\OneToMany(targetEntity: Monster::class, mappedBy: 'zone')]
    private Collection $monsters;

    public function __construct()
    {
        $this->monsters = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

        return $this;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getMinLevel(): int
    {
        return $this->minLevel;
    }

    public function getMaxLevel(): int
    {
        return $this->maxLevel;
    }

    public function setLevels(int $minLevel, int $maxLevel): static
    {
        $this->minLevel = $minLevel;
        $this->maxLevel = $maxLevel;

        return $this;
    }

    public function isSafe(): bool
    {
        return $this->safe;
    }

    public function setSafe(bool $safe): static
    {
        $this->safe = $safe;

        return $this;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): static
    {
        $this->position = $position;

        return $this;
    }

    /** @return Collection<int, Monster> */
    public function getMonsters(): Collection
    {
        return $this->monsters;
    }
}
