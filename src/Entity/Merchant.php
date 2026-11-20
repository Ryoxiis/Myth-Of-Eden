<?php

namespace App\Entity;

use App\Repository\MerchantRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Marchand (PNJ) : il vend une liste d'objets et rachète le butin des joueurs.
 */
#[ORM\Entity(repositoryClass: MerchantRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_MERCHANT_CODE', fields: ['code'])]
#[UniqueEntity(fields: ['code'])]
class Merchant
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

    /** Phrase d'accueil affichée dans la boutique. */
    #[ORM\Column(length: 255)]
    private string $greeting = '';

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Zone $zone = null;

    /** Position du marchand dans la zone (le client place le PNJ ici). */
    #[ORM\Column]
    private float $x = 0.0;

    #[ORM\Column]
    private float $z = 0.0;

    /** Part de la valeur d'un objet rendue quand on le revend (0,25 = 25 %). */
    #[ORM\Column]
    #[Assert\Range(min: 0, max: 1)]
    private float $buybackRate = 0.25;

    /** @var Collection<int, MerchantOffer> */
    #[ORM\OneToMany(targetEntity: MerchantOffer::class, mappedBy: 'merchant', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    private Collection $offers;

    public function __construct()
    {
        $this->offers = new ArrayCollection();
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

    public function getGreeting(): string
    {
        return $this->greeting;
    }

    public function setGreeting(string $greeting): static
    {
        $this->greeting = $greeting;

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

    public function setPosition(float $x, float $z): static
    {
        $this->x = $x;
        $this->z = $z;

        return $this;
    }

    public function getBuybackRate(): float
    {
        return $this->buybackRate;
    }

    public function setBuybackRate(float $buybackRate): static
    {
        $this->buybackRate = $buybackRate;

        return $this;
    }

    /** @return Collection<int, MerchantOffer> */
    public function getOffers(): Collection
    {
        return $this->offers;
    }

    public function addOffer(MerchantOffer $offer): static
    {
        if (!$this->offers->contains($offer)) {
            $this->offers->add($offer);
            $offer->setMerchant($this);
            $offer->setPosition($this->offers->count());
        }

        return $this;
    }
}
