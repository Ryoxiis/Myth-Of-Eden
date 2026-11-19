<?php

namespace App\Entity;

use App\Repository\QuestStepRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Étape d'une quête : un objectif affiché dans le journal (et sur la carte via targetZone).
 */
#[ORM\Entity(repositoryClass: QuestStepRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_QUEST_STEP_CODE', columns: ['quest_id', 'code'])]
#[ORM\UniqueConstraint(name: 'UNIQ_QUEST_STEP_POSITION', columns: ['quest_id', 'position'])]
class QuestStep
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'steps')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Quest $quest = null;

    #[ORM\Column(type: Types::SMALLINT)]
    #[Assert\Positive]
    private int $position = 1;

    /** Identifiant stable que le client 3D envoie pour valider l'étape (ex. "enter_ruin"). */
    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    /** Objectif affiché au joueur. */
    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    private ?string $objective = null;

    /** Zone où se trouve l'objectif, pour le marqueur de carte. */
    #[ORM\Column(length: 80, nullable: true)]
    private ?string $targetZone = null;

    public function __construct(int $position = 1, ?string $code = null, ?string $objective = null, ?string $targetZone = null)
    {
        $this->position = $position;
        $this->code = $code;
        $this->objective = $objective;
        $this->targetZone = $targetZone;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getQuest(): ?Quest
    {
        return $this->quest;
    }

    public function setQuest(?Quest $quest): static
    {
        $this->quest = $quest;

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

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;

        return $this;
    }

    public function getObjective(): ?string
    {
        return $this->objective;
    }

    public function setObjective(string $objective): static
    {
        $this->objective = $objective;

        return $this;
    }

    public function getTargetZone(): ?string
    {
        return $this->targetZone;
    }

    public function setTargetZone(?string $targetZone): static
    {
        $this->targetZone = $targetZone;

        return $this;
    }
}
