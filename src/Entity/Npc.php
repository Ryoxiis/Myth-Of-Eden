<?php

namespace App\Entity;

use App\Repository\NpcRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Personnage non joueur (PNJ) avec qui l'on peut parler.
 *
 * Un PNJ peut faire avancer une étape de quête (« Interroger les habitants »…) :
 * quand la quête du joueur est à l'étape `questStepCode`, il raconte `questDialogue`,
 * l'étape est validée et l'indice `clue` est découvert. Sinon il raconte `idleDialogue`.
 */
#[ORM\Entity(repositoryClass: NpcRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_NPC_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Npc
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

    /** Courte description affichée sous le nom (« Ermite du village »…). */
    #[ORM\Column(length: 100)]
    private string $title = '';

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Zone $zone = null;

    #[ORM\Column]
    private float $x = 0.0;

    #[ORM\Column]
    private float $z = 0.0;

    /** Orientation en degrés (0 = regarde vers +Z). */
    #[ORM\Column]
    private float $rotation = 0.0;

    /** Modèle 3D (fichier dans public/models/characters, sans extension). */
    #[ORM\Column(length: 60)]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private string $model = 'mage';

    /** Teinte appliquée au modèle (#rrggbb), pour le distinguer des personnages joueurs. */
    #[ORM\Column(length: 7, nullable: true)]
    #[Assert\Regex('/^#[0-9a-f]{6}$/i')]
    private ?string $tint = null;

    /** Étape de quête que ce PNJ fait avancer (code de QuestStep), ou null. */
    #[ORM\Column(length: 80, nullable: true)]
    private ?string $questStepCode = null;

    /** Indice découvert en lui parlant à la bonne étape. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Clue $clue = null;

    /** @var list<string> Répliques quand il fait avancer la quête. */
    #[ORM\Column(type: 'json')]
    private array $questDialogue = [];

    /** @var list<string> Répliques le reste du temps. */
    #[ORM\Column(type: 'json')]
    #[Assert\Count(min: 1)]
    private array $idleDialogue = [];

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

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getZone(): ?Zone
    {
        return $this->zone;
    }

    public function setZone(Zone $zone): static
    {
        $this->zone = $zone;

        return $this;
    }

    public function getX(): float
    {
        return $this->x;
    }

    public function getZ(): float
    {
        return $this->z;
    }

    public function getRotation(): float
    {
        return $this->rotation;
    }

    public function setPosition(float $x, float $z, float $rotation = 0.0): static
    {
        $this->x = $x;
        $this->z = $z;
        $this->rotation = $rotation;

        return $this;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): static
    {
        $this->model = $model;

        return $this;
    }

    public function getTint(): ?string
    {
        return $this->tint;
    }

    public function setTint(?string $tint): static
    {
        $this->tint = $tint;

        return $this;
    }

    public function getQuestStepCode(): ?string
    {
        return $this->questStepCode;
    }

    public function getClue(): ?Clue
    {
        return $this->clue;
    }

    /** Ce PNJ fait avancer l'étape `$stepCode` et révèle éventuellement un indice. */
    public function setQuestStep(?string $stepCode, ?Clue $clue = null): static
    {
        $this->questStepCode = $stepCode;
        $this->clue = $clue;

        return $this;
    }

    /** @return list<string> */
    public function getQuestDialogue(): array
    {
        return $this->questDialogue;
    }

    /** @param list<string> $lines */
    public function setQuestDialogue(array $lines): static
    {
        $this->questDialogue = array_values($lines);

        return $this;
    }

    /** @return list<string> */
    public function getIdleDialogue(): array
    {
        return $this->idleDialogue;
    }

    /** @param list<string> $lines */
    public function setIdleDialogue(array $lines): static
    {
        $this->idleDialogue = array_values($lines);

        return $this;
    }
}
