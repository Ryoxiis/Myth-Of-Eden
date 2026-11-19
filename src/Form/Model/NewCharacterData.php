<?php

namespace App\Form\Model;

use App\Entity\CharacterClass;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Données saisies dans le formulaire de création de personnage.
 * Objet intermédiaire : l'entité Character n'est créée qu'une fois les données valides.
 */
final class NewCharacterData
{
    /** Silhouettes proposées : code => libellé. */
    public const BODIES = [
        'feminine' => 'Féminine',
        'masculine' => 'Masculine',
    ];

    /** Teintes de peau : code => couleur d'aperçu. */
    public const SKIN_TONES = [
        'porcelain' => '#f1d3c2',
        'sand' => '#d9a982',
        'amber' => '#a8724f',
        'umber' => '#6e4a34',
    ];

    /** Couleurs de cheveux : code => couleur d'aperçu. */
    public const HAIR_COLORS = [
        'black' => '#1d1b1a',
        'brown' => '#5a3a22',
        'auburn' => '#8c3b1f',
        'blond' => '#d6b46a',
        'silver' => '#c9ccd1',
    ];

    #[Assert\NotBlank(message: 'Choisis un nom pour ton personnage.')]
    #[Assert\Length(
        min: 2,
        max: 40,
        minMessage: 'Le nom doit contenir au moins {{ limit }} caractères.',
        maxMessage: 'Le nom ne doit pas dépasser {{ limit }} caractères.',
    )]
    #[Assert\Regex(
        pattern: "/^\p{L}[\p{L}' -]*$/u",
        message: 'Le nom ne peut contenir que des lettres, des espaces, des tirets et des apostrophes.',
    )]
    public ?string $name = null;

    #[Assert\NotNull(message: 'Choisis une classe.')]
    public ?CharacterClass $characterClass = null;

    #[Assert\NotBlank]
    #[Assert\Choice(callback: [self::class, 'bodyCodes'], message: 'Silhouette inconnue.')]
    public ?string $body = 'feminine';

    #[Assert\NotBlank]
    #[Assert\Choice(callback: [self::class, 'skinToneCodes'], message: 'Teinte inconnue.')]
    public ?string $skinTone = 'sand';

    #[Assert\NotBlank]
    #[Assert\Choice(callback: [self::class, 'hairColorCodes'], message: 'Couleur inconnue.')]
    public ?string $hairColor = 'brown';

    /** @return list<string> */
    public static function bodyCodes(): array
    {
        return array_keys(self::BODIES);
    }

    /** @return list<string> */
    public static function skinToneCodes(): array
    {
        return array_keys(self::SKIN_TONES);
    }

    /** @return list<string> */
    public static function hairColorCodes(): array
    {
        return array_keys(self::HAIR_COLORS);
    }

    /**
     * Apparence enregistrée sur le personnage et transmise au client 3D.
     *
     * @return array{body: string, skinTone: string, hairColor: string}
     */
    public function getAppearance(): array
    {
        return [
            'body' => (string) $this->body,
            'skinTone' => (string) $this->skinTone,
            'hairColor' => (string) $this->hairColor,
        ];
    }
}
