<?php

namespace App\DataFixtures;

use App\Entity\CharacterClass;
use App\Entity\Clue;
use App\Entity\Embeddable\Stats;
use App\Entity\Item;
use App\Entity\Quest;
use App\Entity\QuestStep;
use App\Enum\EquipmentSlot;
use App\Enum\ItemCategory;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

/**
 * Données de jeu du prototype : classes, objets, première quête et indices.
 * Les chiffres et les textes sont des valeurs provisoires, à équilibrer.
 *
 * Chargement : php bin/console doctrine:fixtures:load
 */
class AppFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        $this->loadClasses($manager);
        $this->loadItems($manager);
        $this->loadFirstQuest($manager);

        $manager->flush();
    }

    private function loadClasses(ObjectManager $manager): void
    {
        // [code, nom, description, avantages, Stats(santé, endurance, force, agilité, discrétion, magie, pistage)]
        $classes = [
            ['scout', 'Éclaireur', 'Archer agile qui frappe à distance et se déplace sans être vu.',
                ['Attaques à distance à l\'arc', 'Agilité et discrétion élevées'],
                new Stats(100, 100, 4, 7, 7, 2, 5)],
            ['fighter', 'Combattant', 'Guerrier robuste : épée et bouclier pour se défendre, ou armes lourdes pour frapper fort.',
                ['Santé élevée', 'Force élevée', 'Meilleure défense au corps à corps'],
                new Stats(130, 100, 7, 4, 2, 2, 3)],
            ['traveler', 'Voyageur', 'Habitué des longues routes, il endure mieux la fatigue et trouve son chemin partout.',
                ['Endurance élevée', 'Pistage et exploration facilités', 'Bonne agilité'],
                new Stats(100, 130, 4, 6, 4, 2, 7)],
            ['mage', 'Mage', 'Maîtrise une magie interdite et variée, limitée par une ressource encore à définir.',
                ['Sorts plus puissants et plus variés', 'Endurance accrue'],
                new Stats(90, 110, 3, 4, 3, 8, 3)],
        ];

        foreach ($classes as [$code, $name, $description, $advantages, $stats]) {
            $class = (new CharacterClass())
                ->setCode($code)
                ->setName($name)
                ->setDescription($description)
                ->setAdvantages($advantages)
                ->setBaseStats($stats);

            $manager->persist($class);
        }
    }

    private function loadItems(ObjectManager $manager): void
    {
        $items = [
            (new Item())->setCode('apple')->setName('Pomme')
                ->setDescription('Une pomme du verger du village.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 20)
                ->setEffects(['heal' => 5])->setModelPath('models/items/apple.glb'),
            (new Item())->setCode('bandage')->setName('Bandage')
                ->setDescription('Un bandage propre pour soigner une blessure.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 10)
                ->setEffects(['heal' => 30])->setModelPath('models/items/bandage.glb'),
            (new Item())->setCode('short_sword')->setName('Épée courte')
                ->setDescription('Une lame simple mais fiable.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['strength' => 1])->setModelPath('models/items/short_sword.glb'),
            (new Item())->setCode('hunting_bow')->setName('Arc de chasse')
                ->setDescription('Un arc léger, idéal pour chasser en forêt.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['agility' => 1])->setModelPath('models/items/hunting_bow.glb'),
            (new Item())->setCode('oak_staff')->setName('Bâton de chêne')
                ->setDescription('Un bâton de marche… qui semble réagir à la magie.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['magicMastery' => 1])->setModelPath('models/items/oak_staff.glb'),
            // Objet déposé devant la porte : nom et forme provisoires (question encore ouverte).
            (new Item())->setCode('engraved_pendant')->setName('Pendentif gravé')
                ->setDescription('Laissé devant ta porte. Des symboles anciens y sont gravés.')
                ->setCategory(ItemCategory::Quest)->setModelPath('models/items/engraved_pendant.glb'),
        ];

        foreach ($items as $item) {
            $manager->persist($item);
        }
    }

    private function loadFirstQuest(ObjectManager $manager): void
    {
        $quest = (new Quest())
            ->setCode('light_in_the_forest')
            ->setTitle('La lumière dans la forêt')
            ->setSummary('Un objet laissé devant ta porte et une étrange lumière aperçue dans la forêt : ton ancien compagnon a peut-être laissé une piste.')
            ->setMain(true)
            ->setExperienceReward(100);

        $quest
            ->addStep(new QuestStep(1, 'examine_door_object', 'Examiner l\'objet laissé devant ta porte', 'village'))
            ->addStep(new QuestStep(2, 'ask_villagers', 'Interroger les habitants sur la lumière dans la forêt', 'village'))
            ->addStep(new QuestStep(3, 'follow_forest_path', 'Suivre le chemin de la forêt', 'forest_path'))
            ->addStep(new QuestStep(4, 'enter_ruin', 'Trouver l\'entrée de la ruine oubliée', 'ruin'))
            ->addStep(new QuestStep(5, 'activate_mechanism', 'Activer l\'ancien mécanisme grâce à la magie', 'ruin'));

        $manager->persist($quest);

        $clues = [
            (new Clue())->setCode('door_object')->setTitle('L\'objet devant la porte')
                ->setDescription('Ton ancien compagnon a laissé ce pendentif devant chez toi avant de disparaître.'),
            (new Clue())->setCode('forest_light_testimony')->setTitle('Une lumière entre les arbres')
                ->setDescription('Plusieurs habitants ont vu une lumière dans la forêt, du côté des vieilles pierres.'),
        ];

        foreach ($clues as $clue) {
            $manager->persist($clue->setQuest($quest));
        }
    }
}
