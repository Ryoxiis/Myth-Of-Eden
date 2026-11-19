<?php

namespace App\Form;

use App\Entity\CharacterClass;
use App\Form\Model\NewCharacterData;
use App\Repository\CharacterClassRepository;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\ChoiceType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

final class CharacterCreationType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('name', TextType::class, [
                'label' => 'Nom du personnage',
                'attr' => ['maxlength' => 40, 'autocomplete' => 'off', 'placeholder' => 'Ex. : Aelis'],
            ])
            ->add('characterClass', EntityType::class, [
                'label' => 'Classe',
                'class' => CharacterClass::class,
                'choice_label' => 'name',
                'choice_value' => 'code',
                'query_builder' => static fn (CharacterClassRepository $repository): QueryBuilder => $repository
                    ->createQueryBuilder('c')
                    ->orderBy('c.id', 'ASC'),
                'expanded' => true,
                'placeholder' => false,
                'invalid_message' => 'Cette classe n\'existe pas.',
            ])
            ->add('body', ChoiceType::class, [
                'label' => 'Silhouette',
                'choices' => array_flip(NewCharacterData::BODIES),
                'expanded' => true,
                'invalid_message' => 'Choisis une silhouette dans la liste.',
            ])
            ->add('skinTone', ChoiceType::class, [
                'label' => 'Teint',
                'choices' => array_combine(NewCharacterData::skinToneCodes(), NewCharacterData::skinToneCodes()),
                'expanded' => true,
                'invalid_message' => 'Choisis un teint dans la liste.',
            ])
            ->add('hairColor', ChoiceType::class, [
                'label' => 'Cheveux',
                'choices' => array_combine(NewCharacterData::hairColorCodes(), NewCharacterData::hairColorCodes()),
                'expanded' => true,
                'invalid_message' => 'Choisis une couleur de cheveux dans la liste.',
            ])
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => NewCharacterData::class,
            'csrf_message' => 'Le formulaire a expiré. Merci de réessayer.',
        ]);
    }
}
