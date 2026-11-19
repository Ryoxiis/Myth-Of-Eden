<?php

namespace App\Entity;

use App\Entity\Embeddable\Stats;
use App\Repository\CharacterClassRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Classe jouable (Éclaireur, Combattant, Voyageur, Mage…). Donnée de jeu.
 */
#[ORM\Entity(repositoryClass: CharacterClassRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_CHARACTER_CLASS_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class CharacterClass
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** Identifiant stable utilisé par le client 3D (ex. "mage"). */
    #[ORM\Column(length: 50)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT)]
    private string $description = '';

    /**
     * Avantages présentés au joueur lors du choix de classe.
     *
     * @var list<string>
     */
    #[ORM\Column]
    private array $advantages = [];

    #[ORM\Embedded(class: Stats::class, columnPrefix: 'base_')]
    #[Assert\Valid]
    private Stats $baseStats;

    public function __construct()
    {
        $this->baseStats = new Stats();
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

    /** @return list<string> */
    public function getAdvantages(): array
    {
        return $this->advantages;
    }

    /** @param list<string> $advantages */
    public function setAdvantages(array $advantages): static
    {
        $this->advantages = $advantages;

        return $this;
    }

    public function getBaseStats(): Stats
    {
        return $this->baseStats;
    }

    public function setBaseStats(Stats $baseStats): static
    {
        $this->baseStats = $baseStats;

        return $this;
    }

    public function __toString(): string
    {
        return (string) $this->name;
    }
}
