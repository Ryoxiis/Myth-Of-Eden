<?php

namespace App\Entity;

use App\Repository\LootChestRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Coffre laissé par un monstre vaincu. Son contenu est tiré par le serveur au moment de la victoire
 * et reste ici tant que le joueur ne l'a pas récupéré (objet par objet ou tout d'un coup).
 */
#[ORM\Entity(repositoryClass: LootChestRepository::class)]
class LootChest
{
    /** Durée de vie d'un coffre non vidé. */
    public const LIFETIME = '+15 minutes';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?GameSave $gameSave = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Monster $monster = null;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $monsterLevel = 1;

    #[ORM\Column]
    private float $x = 0.0;

    #[ORM\Column]
    private float $z = 0.0;

    /**
     * Objets restants : [{item, rarity, level, bonuses, quantity}].
     *
     * @var list<array{item: string, rarity: string, level: int, bonuses: array<string, int>, quantity: int}>
     */
    #[ORM\Column(type: Types::JSON)]
    private array $contents = [];

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $expiresAt;

    public function __construct(GameSave $gameSave, ?Monster $monster, int $monsterLevel, float $x, float $z)
    {
        $this->gameSave = $gameSave;
        $this->monster = $monster;
        $this->monsterLevel = $monsterLevel;
        $this->x = $x;
        $this->z = $z;
        $this->expiresAt = new \DateTimeImmutable(self::LIFETIME);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGameSave(): ?GameSave
    {
        return $this->gameSave;
    }

    public function getMonster(): ?Monster
    {
        return $this->monster;
    }

    public function getMonsterLevel(): int
    {
        return $this->monsterLevel;
    }

    public function getX(): float
    {
        return $this->x;
    }

    public function getZ(): float
    {
        return $this->z;
    }

    /** @return list<array{item: string, rarity: string, level: int, bonuses: array<string, int>, quantity: int}> */
    public function getContents(): array
    {
        return $this->contents;
    }

    /** @param list<array{item: string, rarity: string, level: int, bonuses: array<string, int>, quantity: int}> $contents */
    public function setContents(array $contents): static
    {
        $this->contents = array_values($contents);

        return $this;
    }

    /** Retire et renvoie l'objet à l'index donné. */
    public function take(int $index): ?array
    {
        $entry = $this->contents[$index] ?? null;
        if (null !== $entry) {
            unset($this->contents[$index]);
            $this->contents = array_values($this->contents);
        }

        return $entry;
    }

    public function isEmpty(): bool
    {
        return [] === $this->contents;
    }

    public function getExpiresAt(): \DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function isExpired(?\DateTimeImmutable $now = null): bool
    {
        return ($now ?? new \DateTimeImmutable()) > $this->expiresAt;
    }
}
