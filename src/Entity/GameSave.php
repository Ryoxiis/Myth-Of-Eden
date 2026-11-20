<?php

namespace App\Entity;

use App\Repository\GameSaveRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Une partie (emplacement de sauvegarde) d'un compte : personnage, position dans le monde,
 * inventaire, quêtes et indices découverts.
 */
#[ORM\Entity(repositoryClass: GameSaveRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_GAME_SAVE_OWNER_SLOT', columns: ['owner_id', 'slot'])]
#[ORM\HasLifecycleCallbacks]
class GameSave
{
    public const DEFAULT_ZONE = 'village';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'gameSaves')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $owner = null;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Range(min: 1, max: User::MAX_GAME_SAVES)]
    private int $slot = 1;

    #[ORM\OneToOne(cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\JoinColumn(nullable: false)]
    #[Assert\Valid]
    private ?Character $character = null;

    /** Zone (scène) où se trouve le personnage, ex. "village", "forest_path", "ruin". */
    #[ORM\Column(length: 80)]
    private string $zone = self::DEFAULT_ZONE;

    #[ORM\Column]
    private float $positionX = 0.0;

    #[ORM\Column]
    private float $positionY = 0.0;

    #[ORM\Column]
    private float $positionZ = 0.0;

    /** Orientation du personnage (rotation autour de l'axe vertical, en degrés). */
    #[ORM\Column]
    private float $rotationY = 0.0;

    #[ORM\Column]
    private int $playTimeSeconds = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $updatedAt;

    /** @var Collection<int, InventoryItem> */
    #[ORM\OneToMany(targetEntity: InventoryItem::class, mappedBy: 'gameSave', cascade: ['persist'], orphanRemoval: true)]
    private Collection $inventoryItems;

    /** @var Collection<int, QuestProgress> */
    #[ORM\OneToMany(targetEntity: QuestProgress::class, mappedBy: 'gameSave', cascade: ['persist'], orphanRemoval: true)]
    private Collection $questProgresses;

    /** @var Collection<int, Clue> */
    #[ORM\ManyToMany(targetEntity: Clue::class)]
    #[ORM\JoinTable(name: 'game_save_clue')]
    private Collection $discoveredClues;

    /**
     * Barre de compétences : un code de compétence (ou null) par emplacement, touches 1 à 6.
     *
     * Colonne nullable : les parties créées avant l'ajout des compétences n'ont pas encore de barre.
     *
     * @var list<string|null>|null
     */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $skillBar = null;

    public const SKILL_BAR_SIZE = 6;

    /** Taille du sac (objets non équipés). */
    public const BAG_SIZE = 24;

    /** Runes : la monnaie du jeu. */
    #[ORM\Column(options: ['default' => 0])]
    #[Assert\PositiveOrZero]
    private int $runes = 0;

    /** Dernière victoire enregistrée (garde-fou contre les envois en rafale). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $lastVictoryAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
        $this->inventoryItems = new ArrayCollection();
        $this->questProgresses = new ArrayCollection();
        $this->discoveredClues = new ArrayCollection();
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(?User $owner): static
    {
        $this->owner = $owner;

        return $this;
    }

    public function getSlot(): int
    {
        return $this->slot;
    }

    public function setSlot(int $slot): static
    {
        $this->slot = $slot;

        return $this;
    }

    public function getCharacter(): ?Character
    {
        return $this->character;
    }

    public function setCharacter(Character $character): static
    {
        $this->character = $character;

        return $this;
    }

    /** Nom affiché de la partie : celui du personnage. */
    public function getDisplayName(): string
    {
        return $this->character?->getName() ?? sprintf('Emplacement %d', $this->slot);
    }

    public function getZone(): string
    {
        return $this->zone;
    }

    public function setZone(string $zone): static
    {
        $this->zone = $zone;

        return $this;
    }

    /** @return array{x: float, y: float, z: float, rotationY: float} */
    public function getPosition(): array
    {
        return [
            'x' => $this->positionX,
            'y' => $this->positionY,
            'z' => $this->positionZ,
            'rotationY' => $this->rotationY,
        ];
    }

    public function moveTo(string $zone, float $x, float $y, float $z, float $rotationY = 0.0): static
    {
        $this->zone = $zone;
        $this->positionX = $x;
        $this->positionY = $y;
        $this->positionZ = $z;
        $this->rotationY = $rotationY;

        return $this;
    }

    public function getPlayTimeSeconds(): int
    {
        return $this->playTimeSeconds;
    }

    public function addPlayTime(int $seconds): static
    {
        $this->playTimeSeconds += max(0, $seconds);

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /** @return Collection<int, InventoryItem> */
    public function getInventoryItems(): Collection
    {
        return $this->inventoryItems;
    }

    public function addInventoryItem(InventoryItem $inventoryItem): static
    {
        if (!$this->inventoryItems->contains($inventoryItem)) {
            $this->inventoryItems->add($inventoryItem);
            $inventoryItem->setGameSave($this);
        }

        return $this;
    }

    public function removeInventoryItem(InventoryItem $inventoryItem): static
    {
        $this->inventoryItems->removeElement($inventoryItem);

        return $this;
    }

    /** @return Collection<int, QuestProgress> */
    public function getQuestProgresses(): Collection
    {
        return $this->questProgresses;
    }

    public function addQuestProgress(QuestProgress $questProgress): static
    {
        if (!$this->questProgresses->contains($questProgress)) {
            $this->questProgresses->add($questProgress);
            $questProgress->setGameSave($this);
        }

        return $this;
    }

    public function removeQuestProgress(QuestProgress $questProgress): static
    {
        $this->questProgresses->removeElement($questProgress);

        return $this;
    }

    /** @return Collection<int, Clue> */
    public function getDiscoveredClues(): Collection
    {
        return $this->discoveredClues;
    }

    public function discoverClue(Clue $clue): static
    {
        if (!$this->discoveredClues->contains($clue)) {
            $this->discoveredClues->add($clue);
        }

        return $this;
    }

    /** Faux pour les parties dont la barre n'a jamais été remplie (créées avant les compétences). */
    public function hasSkillBar(): bool
    {
        return null !== $this->skillBar;
    }

    /** @return list<string|null> toujours SKILL_BAR_SIZE emplacements */
    public function getSkillBar(): array
    {
        $bar = array_values($this->skillBar ?? []);

        return array_pad(\array_slice($bar, 0, self::SKILL_BAR_SIZE), self::SKILL_BAR_SIZE, null);
    }

    /** @param list<string|null> $skillBar */
    public function setSkillBar(array $skillBar): static
    {
        $bar = array_map(static fn ($code) => \is_string($code) && '' !== $code ? $code : null, array_values($skillBar));
        $this->skillBar = array_pad(\array_slice($bar, 0, self::SKILL_BAR_SIZE), self::SKILL_BAR_SIZE, null);

        return $this;
    }

    public function getLastVictoryAt(): ?\DateTimeImmutable
    {
        return $this->lastVictoryAt;
    }

    public function setLastVictoryAt(?\DateTimeImmutable $lastVictoryAt): static
    {
        $this->lastVictoryAt = $lastVictoryAt;

        return $this;
    }

    /** Nombre de lignes du sac (objets non équipés). */
    public function countBagEntries(): int
    {
        return $this->inventoryItems->filter(static fn (InventoryItem $entry) => !$entry->isEquipped())->count();
    }

    public function getRunes(): int
    {
        return $this->runes;
    }

    public function addRunes(int $amount): static
    {
        $this->runes += max(0, $amount);

        return $this;
    }

    /** Retire des runes ; faux (et rien ne change) si le joueur n'en a pas assez. */
    public function spendRunes(int $amount): bool
    {
        if ($amount < 0 || $amount > $this->runes) {
            return false;
        }
        $this->runes -= $amount;

        return true;
    }
}
