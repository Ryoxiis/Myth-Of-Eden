<?php

namespace App\Entity;

use App\Repository\QuestRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Définition d'une quête (donnée de jeu) et de ses étapes ordonnées.
 */
#[ORM\Entity(repositoryClass: QuestRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_QUEST_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Quest
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 80)]
    #[Assert\NotBlank]
    #[Assert\Regex('/^[a-z0-9_]+$/')]
    private ?string $code = null;

    #[ORM\Column(length: 150)]
    #[Assert\NotBlank]
    private ?string $title = null;

    #[ORM\Column(type: Types::TEXT)]
    private string $summary = '';

    /** Quête principale (true) ou secondaire (false). */
    #[ORM\Column]
    private bool $main = false;

    #[ORM\Column]
    #[Assert\PositiveOrZero]
    private int $experienceReward = 0;

    /** @var Collection<int, QuestStep> */
    #[ORM\OneToMany(targetEntity: QuestStep::class, mappedBy: 'quest', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    private Collection $steps;

    public function __construct()
    {
        $this->steps = new ArrayCollection();
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

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getSummary(): string
    {
        return $this->summary;
    }

    public function setSummary(string $summary): static
    {
        $this->summary = $summary;

        return $this;
    }

    public function isMain(): bool
    {
        return $this->main;
    }

    public function setMain(bool $main): static
    {
        $this->main = $main;

        return $this;
    }

    public function getExperienceReward(): int
    {
        return $this->experienceReward;
    }

    public function setExperienceReward(int $experienceReward): static
    {
        $this->experienceReward = $experienceReward;

        return $this;
    }

    /** @return Collection<int, QuestStep> */
    public function getSteps(): Collection
    {
        return $this->steps;
    }

    public function getFirstStep(): ?QuestStep
    {
        return $this->steps->first() ?: null;
    }

    /** Étape qui suit $step, ou null si $step est la dernière. */
    public function getStepAfter(QuestStep $step): ?QuestStep
    {
        foreach ($this->steps as $candidate) {
            if ($candidate->getPosition() > $step->getPosition()) {
                return $candidate;
            }
        }

        return null;
    }

    public function addStep(QuestStep $step): static
    {
        if (!$this->steps->contains($step)) {
            $this->steps->add($step);
            $step->setQuest($this);
        }

        return $this;
    }

    public function removeStep(QuestStep $step): static
    {
        $this->steps->removeElement($step);

        return $this;
    }
}
