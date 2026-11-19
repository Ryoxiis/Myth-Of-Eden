<?php

namespace App\Entity;

use App\Entity\Embeddable\Stats;
use App\Repository\CharacterRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Personnage du joueur dans une partie : identité, classe, niveau et caractéristiques.
 * La table s'appelle game_character car CHARACTER est un mot réservé en SQL.
 */
#[ORM\Entity(repositoryClass: CharacterRepository::class)]
#[ORM\Table(name: 'game_character')]
class Character
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 40)]
    #[Assert\NotBlank(message: 'Choisis un nom pour ton personnage.')]
    #[Assert\Length(min: 2, max: 40)]
    private ?string $name = null;

    /**
     * Choix d'apparence transmis au client 3D (modèle, couleur des cheveux, etc.).
     *
     * @var array<string, mixed>
     */
    #[ORM\Column]
    private array $appearance = [];

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\NotNull(message: 'Choisis une classe.')]
    private ?CharacterClass $characterClass = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $level = 1;

    #[ORM\Column]
    private int $experience = 0;

    /** Points de caractéristiques gagnés à la montée de niveau, pas encore répartis. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $unspentStatPoints = 0;

    /** Caractéristiques maximales actuelles (hors bonus d'équipement). */
    #[ORM\Embedded(class: Stats::class, columnPrefix: 'stat_')]
    #[Assert\Valid]
    private Stats $stats;

    /** Santé actuelle (les blessures se soignent simplement). */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $currentHealth = 100;

    public function __construct()
    {
        $this->stats = new Stats();
    }

    /**
     * Applique la classe choisie et ses caractéristiques de départ.
     */
    public function applyClass(CharacterClass $characterClass): static
    {
        $this->characterClass = $characterClass;
        $this->stats = $characterClass->getBaseStats()->copy();
        $this->currentHealth = $this->stats->getHealth();

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = trim($name);

        return $this;
    }

    /** @return array<string, mixed> */
    public function getAppearance(): array
    {
        return $this->appearance;
    }

    /** @param array<string, mixed> $appearance */
    public function setAppearance(array $appearance): static
    {
        $this->appearance = $appearance;

        return $this;
    }

    public function getCharacterClass(): ?CharacterClass
    {
        return $this->characterClass;
    }

    public function getLevel(): int
    {
        return $this->level;
    }

    public function setLevel(int $level): static
    {
        $this->level = $level;

        return $this;
    }

    public function getExperience(): int
    {
        return $this->experience;
    }

    public function setExperience(int $experience): static
    {
        $this->experience = $experience;

        return $this;
    }

    /** Expérience totale à atteindre pour passer au niveau suivant (règle provisoire : niveau × 100). */
    public function getExperienceForNextLevel(): int
    {
        return $this->level * 100;
    }

    /** Progression vers le niveau suivant, de 0 à 100 %. */
    public function getLevelProgressPercent(): int
    {
        $previous = ($this->level - 1) * 100;
        $span = max(1, $this->getExperienceForNextLevel() - $previous);

        return (int) max(0, min(100, round(($this->experience - $previous) / $span * 100)));
    }

    public function getUnspentStatPoints(): int
    {
        return $this->unspentStatPoints;
    }

    public function setUnspentStatPoints(int $unspentStatPoints): static
    {
        $this->unspentStatPoints = $unspentStatPoints;

        return $this;
    }

    public function getStats(): Stats
    {
        return $this->stats;
    }

    public function getCurrentHealth(): int
    {
        return $this->currentHealth;
    }

    public function setCurrentHealth(int $currentHealth): static
    {
        $this->currentHealth = max(0, min($currentHealth, $this->stats->getHealth()));

        return $this;
    }
}
