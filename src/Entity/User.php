<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Compte joueur. Un compte possède quelques emplacements de partie.
 */
#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
#[ORM\UniqueConstraint(name: 'UNIQ_USER_EMAIL', fields: ['email'])]
#[UniqueEntity(fields: ['email'], message: 'Un compte existe déjà avec cette adresse e-mail.')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    /** Nombre d'emplacements de partie par compte (2 ou 3 : à décider). */
    public const MAX_GAME_SAVES = 3;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    #[Assert\NotBlank(message: 'Indique ton adresse e-mail.')]
    #[Assert\Email(message: 'Cette adresse e-mail n\'est pas valide.')]
    #[Assert\Length(max: 180, maxMessage: 'L\'adresse e-mail ne doit pas dépasser {{ limit }} caractères.')]
    private ?string $email = null;

    /** @var list<string> */
    #[ORM\Column]
    private array $roles = [];

    /** Mot de passe haché. */
    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, GameSave> */
    #[ORM\OneToMany(targetEntity: GameSave::class, mappedBy: 'owner', orphanRemoval: true)]
    #[ORM\OrderBy(['slot' => 'ASC'])]
    private Collection $gameSaves;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->gameSaves = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = mb_strtolower(trim($email));

        return $this;
    }

    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /** @return list<string> */
    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';

        return array_values(array_unique($roles));
    }

    /** @param list<string> $roles */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    public function eraseCredentials(): void
    {
        // Aucune donnée sensible temporaire stockée sur l'utilisateur.
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, GameSave> */
    public function getGameSaves(): Collection
    {
        return $this->gameSaves;
    }

    public function canCreateGameSave(): bool
    {
        return $this->gameSaves->count() < self::MAX_GAME_SAVES;
    }

    /** Premier emplacement libre (1, 2, 3…), ou null si tous sont occupés. */
    public function getFirstFreeSlot(): ?int
    {
        $used = $this->gameSaves->map(static fn (GameSave $save) => $save->getSlot())->toArray();

        for ($slot = 1; $slot <= self::MAX_GAME_SAVES; ++$slot) {
            if (!\in_array($slot, $used, true)) {
                return $slot;
            }
        }

        return null;
    }

    public function addGameSave(GameSave $gameSave): static
    {
        if (!$this->gameSaves->contains($gameSave)) {
            $this->gameSaves->add($gameSave);
            $gameSave->setOwner($this);
        }

        return $this;
    }

    public function removeGameSave(GameSave $gameSave): static
    {
        $this->gameSaves->removeElement($gameSave);

        return $this;
    }
}
