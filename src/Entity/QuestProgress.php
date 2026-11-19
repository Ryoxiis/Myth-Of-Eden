<?php

namespace App\Entity;

use App\Enum\QuestStatus;
use App\Repository\QuestProgressRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Avancement d'une quête dans une partie donnée.
 */
#[ORM\Entity(repositoryClass: QuestProgressRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_QUEST_PROGRESS', columns: ['game_save_id', 'quest_id'])]
class QuestProgress
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'questProgresses')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?GameSave $gameSave = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    private ?Quest $quest = null;

    /** Étape en cours, ou null quand la quête est terminée. */
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?QuestStep $currentStep = null;

    #[ORM\Column(enumType: QuestStatus::class)]
    private QuestStatus $status = QuestStatus::InProgress;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $completedAt = null;

    public function __construct(?Quest $quest = null)
    {
        $this->startedAt = new \DateTimeImmutable();

        if (null !== $quest) {
            $this->quest = $quest;
            $this->currentStep = $quest->getFirstStep();
        }
    }

    /**
     * Passe à l'étape suivante ; termine la quête après la dernière étape.
     */
    public function advance(): static
    {
        if (QuestStatus::InProgress !== $this->status || null === $this->currentStep) {
            return $this;
        }

        $next = $this->quest?->getStepAfter($this->currentStep);

        if (null === $next) {
            $this->currentStep = null;
            $this->status = QuestStatus::Completed;
            $this->completedAt = new \DateTimeImmutable();
        } else {
            $this->currentStep = $next;
        }

        return $this;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getGameSave(): ?GameSave
    {
        return $this->gameSave;
    }

    public function setGameSave(?GameSave $gameSave): static
    {
        $this->gameSave = $gameSave;

        return $this;
    }

    public function getQuest(): ?Quest
    {
        return $this->quest;
    }

    public function getCurrentStep(): ?QuestStep
    {
        return $this->currentStep;
    }

    public function getStatus(): QuestStatus
    {
        return $this->status;
    }

    public function isCompleted(): bool
    {
        return QuestStatus::Completed === $this->status;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getCompletedAt(): ?\DateTimeImmutable
    {
        return $this->completedAt;
    }
}
