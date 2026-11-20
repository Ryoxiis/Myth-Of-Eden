<?php

namespace App\DataFixtures;

use App\Entity\Character;
use App\Entity\CharacterClass;
use App\Entity\Clue;
use App\Entity\Embeddable\Stats;
use App\Entity\GameSave;
use App\Entity\InventoryItem;
use App\Entity\Item;
use App\Entity\Quest;
use App\Entity\QuestProgress;
use App\Entity\QuestStep;
use App\Entity\Skill;
use App\Entity\Monster;
use App\Entity\Merchant;
use App\Entity\MerchantOffer;
use App\Entity\Zone;
use App\Enum\EquipmentSlot;
use App\Enum\ItemCategory;
use App\Enum\SkillType;
use App\Enum\MonsterTier;
use App\Enum\Rarity;
use App\Entity\User;
use App\Service\NpcInstaller;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Données de jeu du prototype : classes, objets, première quête et indices.
 * Les chiffres et les textes sont des valeurs provisoires, à équilibrer.
 *
 * Crée aussi un compte de démonstration : demo@myth-of-eden.test / demo1234.
 *
 * Chargement : php bin/console doctrine:fixtures:load (vide la base avant !)
 */
class AppFixtures extends Fixture
{
    public const DEMO_EMAIL = 'demo@myth-of-eden.test';
    public const DEMO_PASSWORD = 'demo1234';

    /** @var array<string, CharacterClass> */
    private array $classes = [];
    /** @var array<string, Item> */
    private array $items = [];
    private ?Quest $mainQuest = null;
    /** @var array<string, Clue> */
    private array $clues = [];
    /** @var array<string, Zone> */
    private array $zones = [];

    public function __construct(
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly NpcInstaller $npcInstaller,
    )
    {
    }

    public function load(ObjectManager $manager): void
    {
        $this->loadClasses($manager);
        $this->loadSkills($manager);
        $this->loadItems($manager);
        $this->loadFirstQuest($manager);
        $this->loadWorld($manager);
        $this->loadMerchants($manager);
        $this->loadNpcs();
        $manager->flush();

        $this->loadDemoAccount($manager);
        $manager->flush();
    }

    /**
     * Compétences par classe : [code, nom, description, type, niveau requis, recharge (s), endurance, puissance, portée (m), icône, animation, effet].
     * Valeurs provisoires, à équilibrer.
     */
    private const SKILLS = [
        'scout' => [
            ['precise_shot', 'Tir précis', 'Une flèche tirée avec calme, droit vers la cible.', SkillType::Attack, 1, 1.5, 10, 14, 25, 'arrow', '1H_Ranged_Shoot', 'arrow'],
            ['silent_step', 'Pas feutré', 'Vos pas ne font plus de bruit pendant quelques secondes : les créatures vous remarquent moins.', SkillType::Utility, 1, 14, 20, 0, 0, 'feather', 'Interact', 'smoke'],
            ['tracker_eye', 'Œil du pisteur', 'Les traces et les objets cachés autour de vous se mettent à luire un instant.', SkillType::Utility, 2, 20, 15, 0, 18, 'eye', 'Interact', 'sense'],
            ['dodge_roll', 'Roulade', 'Une roulade rapide pour échapper à un coup.', SkillType::Defense, 3, 6, 15, 0, 0, 'wind', 'Dodge_Forward', 'wind'],
            ['arrow_volley', 'Volée de flèches', 'Trois flèches en éventail pour toucher plusieurs cibles.', SkillType::Attack, 5, 10, 35, 30, 22, 'arrows', '1H_Ranged_Shooting', 'arrow'],
            ['bramble_trap', 'Piège de ronces', 'Des ronces jaillissent du sol et retiennent ce qui passe dessus.', SkillType::Utility, 7, 18, 30, 12, 8, 'thorns', 'Throw', 'leaf'],
            ['moon_arrow', 'Flèche de lune', 'Une flèche chargée de la lumière de la lune, qui transperce tout sur son passage.', SkillType::Attack, 10, 30, 50, 80, 35, 'moon', '2H_Ranged_Shoot', 'frost'],
        ],
        'fighter' => [
            ['heavy_strike', 'Frappe puissante', 'Un coup d\'épée de toute votre force.', SkillType::Attack, 1, 1.2, 8, 16, 2.6, 'sword', '1H_Melee_Attack_Chop', 'slash'],
            ['parry', 'Parade', 'Vous levez votre garde et encaissez le prochain coup sans broncher.', SkillType::Defense, 1, 6, 10, 0, 0, 'shield', 'Block', 'shield'],
            ['war_cry', 'Cri de guerre', 'Un cri qui raffermit votre courage : vos coups frappent plus fort un moment.', SkillType::Buff, 2, 25, 20, 0, 0, 'horn', 'Cheer', 'fire'],
            ['shield_bash', 'Coup de bouclier', 'Vous projetez votre bouclier en avant pour déséquilibrer l\'adversaire.', SkillType::Attack, 3, 8, 15, 10, 2.4, 'shield_bash', 'Block_Attack', 'slash'],
            ['whirlwind', 'Tourbillon', 'Une rotation complète qui frappe tout autour de vous.', SkillType::Attack, 5, 12, 35, 28, 3.5, 'whirl', '2H_Melee_Attack_Spin', 'whirl'],
            ['second_wind', 'Second souffle', 'Vous reprenez votre souffle et refermez vos plaies.', SkillType::Heal, 7, 45, 0, 40, 0, 'heart', 'Cheer', 'heal'],
            ['heroic_charge', 'Charge héroïque', 'Un élan irrésistible vers l\'ennemi, conclu par un coup dévastateur.', SkillType::Attack, 10, 20, 40, 50, 8, 'bolt', '1H_Melee_Attack_Stab', 'whirl'],
        ],
        'traveler' => [
            ['quick_thrust', 'Estoc', 'Une attaque rapide et précise, apprise sur les routes.', SkillType::Attack, 1, 1.3, 8, 12, 2.6, 'sword', '1H_Melee_Attack_Stab', 'slash'],
            ['field_dressing', 'Pansement de fortune', 'Un bandage improvisé qui soigne un peu.', SkillType::Heal, 1, 20, 15, 15, 0, 'heart', 'Use_Item', 'heal'],
            ['second_breath', 'Bon pied', 'Vous retrouvez votre endurance d\'un coup.', SkillType::Buff, 2, 30, 0, 50, 0, 'boot', 'Interact', 'wind'],
            ['stone_throw', 'Lancer de pierre', 'Une pierre bien lancée, utile pour attirer l\'attention ou blesser de loin.', SkillType::Attack, 3, 4, 10, 10, 18, 'stone', 'Throw', 'stone'],
            ['traveler_instinct', 'Instinct du voyageur', 'Vous sentez la bonne direction : le chemin vers votre objectif s\'illumine.', SkillType::Utility, 5, 25, 20, 0, 30, 'compass', 'Interact', 'sense'],
            ['campfire', 'Feu de camp', 'Un petit feu qui réchauffe et soigne tant qu\'on reste près de lui.', SkillType::Heal, 7, 60, 30, 50, 0, 'flame', 'Use_Item', 'fire'],
            ['iron_will', 'Volonté de fer', 'Rien ne peut vous arrêter : vous résistez aux coups pendant un moment.', SkillType::Defense, 10, 60, 0, 0, 0, 'mountain', 'Cheer', 'shield'],
        ],
        'mage' => [
            ['arcane_bolt', 'Trait arcanique', 'Un trait de magie pure qui file vers la cible.', SkillType::Spell, 1, 1.5, 12, 15, 25, 'bolt', 'Spellcast_Shoot', 'arcane'],
            ['light_orb', 'Lumière', 'Une sphère de lumière vous accompagne et éclaire la nuit.', SkillType::Utility, 1, 12, 15, 0, 0, 'sun', 'Spellcast_Raise', 'light'],
            ['fireball', 'Boule de feu', 'Une boule de flammes qui explose à l\'impact.', SkillType::Spell, 2, 6, 25, 30, 25, 'flame', 'Spellcast_Shoot', 'fire'],
            ['mana_shield', 'Bouclier de mana', 'Une bulle d\'énergie absorbe les prochains coups.', SkillType::Defense, 3, 20, 30, 0, 0, 'shield', 'Spellcast_Raise', 'shield'],
            ['frost_nova', 'Givre', 'Une onde de froid gèle tout autour de vous.', SkillType::Spell, 5, 12, 35, 25, 5, 'snowflake', 'Spellcast_Long', 'frost'],
            ['rune_heal', 'Soin runique', 'Des runes lumineuses tournent autour de vous et referment vos blessures.', SkillType::Heal, 7, 25, 35, 45, 0, 'heart', 'Spellcasting', 'heal'],
            ['portal_echo', 'Écho du portail', 'Vous appelez un éclat de la lumière turquoise de la légende. Personne ne sait d\'où vient ce pouvoir.', SkillType::Spell, 10, 60, 60, 100, 20, 'portal', 'Spellcast_Long', 'arcane'],
        ],
    ];

    private function loadSkills(ObjectManager $manager): void
    {
        foreach (self::SKILLS as $classCode => $skills) {
            foreach ($skills as $position => [$code, $name, $description, $type, $level, $cooldown, $cost, $power, $range, $icon, $animation, $effect]) {
                $manager->persist((new Skill())
                    ->setCode($code)->setName($name)->setDescription($description)
                    ->setCharacterClass($this->classes[$classCode])->setType($type)
                    ->setRequiredLevel($level)->setPosition($position)
                    ->setCooldown($cooldown)->setCost($cost)->setPower($power)->setRange($range)
                    ->setIcon($icon)->setAnimation($animation)->setEffect($effect));
            }
        }
    }

    /**
     * Équipements trouvables sur les monstres : [code, nom, description, emplacement, bonus de base, modèle 3D, niveau minimal].
     * La rareté et le niveau du monstre multiplient ces bonus au moment du butin.
     */
    private const EQUIPMENT = [
        // Armes (main principale)
        ['long_sword', 'Épée longue', 'Une lame à deux mains, lourde et sûre.', EquipmentSlot::MainHand, ['strength' => 3], 'sword_2handed', 3],
        ['runed_greatsword', 'Grande épée runique', 'Des runes bleutées courent le long du fil.', EquipmentSlot::MainHand, ['strength' => 4, 'magicMastery' => 1], 'sword_2handed_color', 8],
        ['bone_blade', 'Lame d\'os', 'Taillée dans l\'os d\'une bête oubliée.', EquipmentSlot::MainHand, ['strength' => 2, 'agility' => 1], 'skeleton_blade', 1],
        ['hand_axe', 'Hachette', 'Pour le bois… et le reste.', EquipmentSlot::MainHand, ['strength' => 2], 'axe_1handed', 1],
        ['war_axe', 'Hache de guerre', 'Une hache à deux mains qui fend les boucliers.', EquipmentSlot::MainHand, ['strength' => 4], 'axe_2handed', 5],
        ['bone_axe', 'Hache d\'os', 'Grossière mais redoutable.', EquipmentSlot::MainHand, ['strength' => 3, 'health' => 4], 'skeleton_axe', 4],
        ['dagger', 'Dague', 'Courte, rapide, discrète.', EquipmentSlot::MainHand, ['agility' => 2, 'stealth' => 1], 'dagger', 1],
        ['heavy_crossbow', 'Arbalète lourde', 'Plus lente à recharger, bien plus puissante.', EquipmentSlot::MainHand, ['agility' => 3, 'strength' => 1], 'crossbow_2handed', 4],
        ['bone_crossbow', 'Arbalète d\'os', 'Ses carreaux sifflent comme le vent.', EquipmentSlot::MainHand, ['agility' => 2, 'tracking' => 2], 'skeleton_crossbow', 6],
        ['bone_staff', 'Bâton d\'os', 'Un crâne au sommet murmure des formules.', EquipmentSlot::MainHand, ['magicMastery' => 3], 'skeleton_staff', 3],
        ['wand', 'Baguette', 'Légère, précise, faite pour les sorts rapides.', EquipmentSlot::MainHand, ['magicMastery' => 2, 'agility' => 1], 'wand', 1],
        // Main secondaire
        ['round_shield', 'Bouclier rond', 'Un bouclier de bois cerclé de fer.', EquipmentSlot::OffHand, ['health' => 6], 'shield_round', 1],
        ['painted_shield', 'Bouclier peint', 'Aux couleurs d\'une garde disparue.', EquipmentSlot::OffHand, ['health' => 8, 'strength' => 1], 'shield_round_color', 3],
        ['badge_shield', 'Écu blasonné', 'Porte l\'emblème d\'une maison noble.', EquipmentSlot::OffHand, ['health' => 9], 'shield_badge', 2],
        ['royal_shield', 'Écu royal', 'Un blason doré qui inspire le respect.', EquipmentSlot::OffHand, ['health' => 12, 'stamina' => 4], 'shield_badge_color', 7],
        ['spiked_shield', 'Bouclier à pointes', 'Il blesse autant qu\'il protège.', EquipmentSlot::OffHand, ['health' => 7, 'strength' => 2], 'shield_spikes', 4],
        ['tower_shield', 'Pavois', 'Un mur portatif.', EquipmentSlot::OffHand, ['health' => 15], 'shield_square', 5],
        ['barbarian_shield', 'Bouclier barbare', 'Épais, cabossé, increvable.', EquipmentSlot::OffHand, ['health' => 10, 'stamina' => 3], 'shield_round_barbarian', 3],
        ['bone_buckler', 'Rondache d\'os', 'Petite et légère.', EquipmentSlot::OffHand, ['health' => 5, 'agility' => 1], 'skeleton_shield_small_a', 1],
        ['bone_bulwark', 'Rempart d\'os', 'Fait de côtes et de crânes assemblés.', EquipmentSlot::OffHand, ['health' => 16, 'strength' => 1], 'skeleton_shield_large_a', 8],
        ['arcane_tome', 'Grimoire ouvert', 'Ses pages tournent toutes seules.', EquipmentSlot::OffHand, ['magicMastery' => 2, 'stamina' => 3], 'spellbook_open', 2],
        ['hunter_quiver', 'Carquois de chasseur', 'Toujours une flèche sous la main.', EquipmentSlot::OffHand, ['agility' => 1, 'tracking' => 2], 'quiver', 1],
        // Armures (effet visuel : aura de rareté)
        ['leather_hood', 'Capuchon de cuir', 'Protège de la pluie et des regards.', EquipmentSlot::Head, ['stealth' => 1, 'health' => 3], null, 1],
        ['iron_helm', 'Heaume de fer', 'Lourd, mais rassurant.', EquipmentSlot::Head, ['health' => 8], null, 4],
        ['traveler_tunic', 'Tunique de voyage', 'Usée par les routes.', EquipmentSlot::Body, ['stamina' => 5, 'health' => 4], null, 1],
        ['chainmail', 'Cotte de mailles', 'Des milliers d\'anneaux d\'acier.', EquipmentSlot::Body, ['health' => 14], null, 5],
        ['leather_gloves', 'Gants de cuir', 'Une prise sûre sur l\'arme.', EquipmentSlot::Hands, ['agility' => 1, 'strength' => 1], null, 1],
        ['swift_boots', 'Bottes agiles', 'Le pas léger du chasseur.', EquipmentSlot::Feet, ['agility' => 2, 'stamina' => 3], null, 2],
        ['moon_ring', 'Anneau de lune', 'Il luit faiblement la nuit.', EquipmentSlot::Accessory, ['magicMastery' => 2], null, 3],
        ['tracker_amulet', 'Amulette du pisteur', 'Une dent de loup sur un lacet.', EquipmentSlot::Accessory, ['tracking' => 2, 'stealth' => 1], null, 2],
    ];

    /**
     * Zones du monde ouvert : [code, nom, description, niveau min, niveau max, zone sûre].
     * Monstres : [code, nom, rang, modèle, arme, teinte, échelle, PV, dégâts, portée, vitesse, expérience, population].
     */
    private const ZONES = [
        ['village', 'Village forestier', 'Votre village. Aucun monstre n\'ose y entrer.', 1, 1, true, []],
        ['lisiere', 'Bois de la Lisière', 'Les bois autour du village, où rôdent squelettes égarés et détrousseurs.', 1, 3, false, [
            ['skeleton_wanderer', 'Squelette errant', MonsterTier::Normal, 'skeleton_minion', 'skeleton_blade', null, 1.0, 40, 5, 1.8, 2.4, 10, 30],
            ['footpad', 'Détrousseur', MonsterTier::Normal, 'bandit_rogue', 'dagger', '#7a5a3a', 1.0, 34, 6, 1.7, 3.0, 11, 14],
            ['footpad_chief', 'Chef détrousseur', MonsterTier::Elite, 'bandit_brute', 'axe_1handed', '#8b3a2a', 1.25, 150, 11, 2.0, 2.8, 14, 3],
        ]],
        ['chemin', 'Chemin de la forêt', 'Le vieux chemin vers le nord. Les morts n\'y reposent pas en paix.', 3, 6, false, [
            ['skeleton_soldier', 'Squelette guerrier', MonsterTier::Normal, 'skeleton_warrior', 'skeleton_axe', null, 1.05, 55, 7, 1.9, 2.5, 12, 26],
            ['skeleton_archer', 'Squelette archer', MonsterTier::Normal, 'skeleton_rogue', 'skeleton_crossbow', null, 1.0, 36, 6, 14, 2.6, 12, 16],
            ['skeleton_caster', 'Mage squelette', MonsterTier::Normal, 'skeleton_mage', 'skeleton_staff', null, 1.0, 32, 8, 12, 2.3, 13, 10],
            ['fallen_knight', 'Chevalier déchu', MonsterTier::Elite, 'fallen_knight', 'sword_2handed', '#4a4a58', 1.25, 190, 13, 2.2, 2.6, 15, 3],
        ]],
        ['collines', 'Collines rocheuses', 'À l\'est, des pillards ont établi leurs camps entre les rochers.', 6, 9, false, [
            ['hill_brute', 'Brute des collines', MonsterTier::Normal, 'bandit_brute', 'axe_2handed', '#6b6b4a', 1.1, 75, 9, 2.1, 2.6, 13, 24],
            ['raider', 'Pillard', MonsterTier::Normal, 'bandit_rogue', 'crossbow_1handed', '#5a4a6a', 1.0, 45, 7, 14, 2.9, 12, 18],
            ['raider_lord', 'Seigneur pillard', MonsterTier::Elite, 'bandit_brute', 'war_axe_model', '#7a2020', 1.35, 220, 15, 2.3, 2.7, 16, 3],
            ['brannoc', 'Brannoc, chef de guerre', MonsterTier::Boss, 'bandit_brute', 'axe_2handed', '#3a1010', 1.9, 900, 22, 2.8, 2.8, 20, 1],
        ]],
        ['sombrebois', 'Sombrebois', 'À l\'ouest, une forêt où la lumière ne passe plus. Une magie ancienne y relève les morts.', 9, 12, false, [
            ['cursed_skeleton', 'Squelette maudit', MonsterTier::Normal, 'skeleton_warrior', 'skeleton_blade', '#6a4a9a', 1.1, 70, 10, 1.9, 2.6, 14, 26],
            ['necromancer', 'Nécromancien', MonsterTier::Normal, 'skeleton_mage', 'skeleton_staff', '#4a2a6a', 1.05, 48, 11, 12, 2.3, 14, 14],
            ['wandering_lich', 'Liche errante', MonsterTier::Elite, 'skeleton_mage', 'skeleton_staff', '#2a7a8a', 1.45, 240, 17, 13, 2.4, 17, 3],
        ]],
        ['ruine', 'Ruine oubliée', 'La clairière de l\'arche de pierre. Quelque chose garde le passage.', 12, 15, false, [
            ['bone_guardian', 'Gardien d\'os', MonsterTier::Normal, 'skeleton_warrior', 'skeleton_axe', '#3a8a9a', 1.2, 90, 12, 2.0, 2.6, 15, 14],
            ['spectral_archer', 'Archer spectral', MonsterTier::Normal, 'skeleton_rogue', 'skeleton_crossbow', '#5fd6e3', 1.0, 60, 11, 15, 2.7, 15, 10],
            ['ruin_warden', 'Gardien de la Ruine', MonsterTier::Boss, 'skeleton_warrior', 'sword_2handed_color', '#1fa6b8', 2.3, 1400, 26, 3.0, 2.5, 25, 1],
        ]],
    ];

    /** Marchands : [code de l'objet, prix en runes, rareté]. */
    private const MERCHANT_OFFERS = [
        ['small_health_potion', 30, Rarity::Common], ['health_potion', 75, Rarity::Common],
        ['apple', 6, Rarity::Common], ['bandage', 15, Rarity::Common],
        ['short_sword', 45, Rarity::Common], ['dagger', 40, Rarity::Common], ['hand_axe', 45, Rarity::Common],
        ['hunting_bow', 45, Rarity::Common], ['wand', 45, Rarity::Common], ['oak_staff', 40, Rarity::Common],
        ['round_shield', 40, Rarity::Common], ['hunter_quiver', 40, Rarity::Common],
        ['leather_hood', 30, Rarity::Common], ['traveler_tunic', 40, Rarity::Common],
        ['leather_gloves', 30, Rarity::Common], ['swift_boots', 45, Rarity::Common],
        ['long_sword', 220, Rarity::Uncommon], ['arcane_tome', 200, Rarity::Uncommon], ['barbarian_shield', 210, Rarity::Uncommon],
    ];

    private function loadMerchants(ObjectManager $manager): void
    {
        $village = $this->zones['village'] ?? null;
        $merchant = (new Merchant())->setCode('odile')->setName('Odile la colporteuse')
            ->setGreeting('Des lames, des potions et de bonnes affaires ! Et je rachète tout ce que vous rapportez des bois.')
            ->setPosition(3.6, 9.6)->setBuybackRate(0.25);
        if (null !== $village) {
            $merchant->setZone($village);
        }
        foreach (self::MERCHANT_OFFERS as [$code, $price, $rarity]) {
            $merchant->addOffer(new MerchantOffer($this->items[$code], $price, $rarity));
        }
        $manager->persist($merchant);
    }

    /** PNJ (Oldin…) : contenu dans App\Content\NpcCatalog, partagé avec la commande app:pnj:installer. */
    private function loadNpcs(): void
    {
        $this->npcInstaller->install($this->zones, $this->clues);
    }

    private function loadWorld(ObjectManager $manager): void
    {
        foreach (self::ZONES as $position => [$code, $name, $description, $min, $max, $safe, $monsters]) {
            $zone = (new Zone())->setCode($code)->setName($name)->setDescription($description)
                ->setLevels($min, $max)->setSafe($safe)->setPosition($position);
            $manager->persist($zone);
            $this->zones[$code] = $zone;

            foreach ($monsters as [$mCode, $mName, $tier, $model, $weapon, $tint, $scale, $health, $damage, $range, $speed, $xp, $population]) {
                $manager->persist((new Monster())
                    ->setCode($mCode)->setName($mName)->setZone($zone)->setTier($tier)
                    ->setModel($model)->setWeapon('war_axe_model' === $weapon ? 'axe_2handed' : $weapon)->setTint($tint)->setScale($scale)
                    ->setCombat($health, $damage, $range, $speed)->setExperience($xp)->setPopulation($population));
            }
        }
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
            $this->classes[$code] = $class;
        }
    }

    private function loadItems(ObjectManager $manager): void
    {
        $items = [
            (new Item())->setCode('apple')->setName('Pomme')
                ->setDescription('Une pomme du verger du village.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 20)
                ->setEffects(['heal' => 5])->setModelPath('models/items/apple.glb')->setPrice(4),
            (new Item())->setCode('bandage')->setName('Bandage')
                ->setDescription('Un bandage propre pour soigner une blessure.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 10)
                ->setEffects(['heal' => 30])->setModelPath('models/items/bandage.glb')->setPrice(12),
            (new Item())->setCode('small_health_potion')->setName('Petite potion de soin')
                ->setDescription('Un liquide rouge qui sent la cerise et le fer.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 10)
                ->setEffects(['heal' => 45])->setPrice(25),
            (new Item())->setCode('health_potion')->setName('Potion de soin')
                ->setDescription('La recette d\'Odile. Ne pas demander ce qu\'il y a dedans.')
                ->setCategory(ItemCategory::Consumable)->setStackable(true, 10)
                ->setEffects(['heal' => 110])->setPrice(60),
            (new Item())->setCode('short_sword')->setName('Épée courte')
                ->setDescription('Une lame simple mais fiable.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['strength' => 1])->setModelPath('models/equipment/sword_1handed.glb')->setLootable(true)->setPrice(30),
            (new Item())->setCode('hunting_bow')->setName('Arbalète de chasse')
                ->setDescription('Une arbalète légère, idéale pour chasser en forêt.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['agility' => 1])->setModelPath('models/equipment/crossbow_1handed.glb')->setLootable(true)->setPrice(32),
            (new Item())->setCode('oak_staff')->setName('Bâton de chêne')
                ->setDescription('Un bâton de marche… qui semble réagir à la magie.')
                ->setCategory(ItemCategory::Weapon)->setEquipmentSlot(EquipmentSlot::MainHand)
                ->setStatBonuses(['magicMastery' => 1])->setModelPath('models/equipment/staff.glb')->setLootable(true)->setPrice(30),
            // Objet déposé devant la porte : nom et forme provisoires (question encore ouverte).
            (new Item())->setCode('engraved_pendant')->setName('Pendentif gravé')
                ->setDescription('Laissé devant ta porte. Des symboles anciens y sont gravés.')
                ->setCategory(ItemCategory::Quest)->setModelPath('models/items/engraved_pendant.glb'),
        ];

        foreach (self::EQUIPMENT as [$code, $name, $description, $slot, $bonuses, $model, $dropLevel]) {
            $items[] = (new Item())->setCode($code)->setName($name)->setDescription($description)
                ->setCategory(\in_array($slot, [EquipmentSlot::MainHand, EquipmentSlot::OffHand], true) && !str_contains($code, 'quiver') && !str_contains($code, 'tome') ? ItemCategory::Weapon : ItemCategory::Armor)
                ->setEquipmentSlot($slot)->setStatBonuses($bonuses)
                ->setModelPath(null !== $model ? 'models/equipment/'.$model.'.glb' : null)
                ->setLootable(true, $dropLevel)
                ->setPrice(20 + $dropLevel * 12);
        }

        foreach ($items as $item) {
            $manager->persist($item);
            $this->items[$item->getCode()] = $item;
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
        $this->mainQuest = $quest;

        $clues = [
            (new Clue())->setCode('door_object')->setTitle('L\'objet devant la porte')
                ->setDescription('Ton ancien compagnon a laissé ce pendentif devant chez toi avant de disparaître.'),
            (new Clue())->setCode('forest_light_testimony')->setTitle('Une lumière entre les arbres')
                ->setDescription('Plusieurs habitants ont vu une lumière dans la forêt, du côté des vieilles pierres.'),
        ];

        foreach ($clues as $clue) {
            $manager->persist($clue->setQuest($quest));
            $this->clues[$clue->getCode()] = $clue;
        }
    }

    /**
     * Compte de démonstration avec une partie déjà avancée (pour tester ou présenter le projet).
     * Les services ne sont pas utilisés ici pour éviter de relire la base pendant le chargement.
     */
    private function loadDemoAccount(ObjectManager $manager): void
    {
        $user = (new User())->setEmail(self::DEMO_EMAIL);
        $user->setPassword($this->passwordHasher->hashPassword($user, self::DEMO_PASSWORD));
        $manager->persist($user);

        $character = (new Character())
            ->setName('Lyra')
            ->setAppearance(['body' => 'feminine', 'skinTone' => 'amber', 'hairColor' => 'silver'])
            ->applyClass($this->classes['mage'])
            ->setLevel(2)
            ->setExperience(140);
        $character->setCurrentHealth(62); // un peu blessée : de quoi essayer pommes et bandages

        $save = (new GameSave())
            ->setSlot(1)
            ->setCharacter($character)
            ->moveTo('village', 6.0, 0.0, 2.0, 90.0)
            ->addPlayTime(4500)
            ->addRunes(120)
            ->setSkillBar(['arcane_bolt', 'fireball', 'light_orb', null, null, null]);
        $user->addGameSave($save);

        $save->addInventoryItem((new InventoryItem($this->items['oak_staff']))->setEquippedSlot($this->items['oak_staff']->getEquipmentSlot()));
        $save->addInventoryItem(new InventoryItem($this->items['apple'], 5));
        $save->addInventoryItem(new InventoryItem($this->items['bandage'], 2));
        $save->addInventoryItem(new InventoryItem($this->items['engraved_pendant']));
        // Quelques trouvailles pour montrer les raretés.
        $save->addInventoryItem((new InventoryItem($this->items['arcane_tome']))->setRarity(Rarity::Rare)->setItemLevel(2)->setRolledBonuses(['magicMastery' => 4, 'stamina' => 6, 'agility' => 2]));
        $save->addInventoryItem((new InventoryItem($this->items['wand']))->setRarity(Rarity::Epic)->setItemLevel(3)->setRolledBonuses(['magicMastery' => 6, 'agility' => 3, 'health' => 9, 'tracking' => 2]));

        $progress = new QuestProgress($this->mainQuest);
        $progress->advance(); // pendentif examiné : étape 2, interroger les habitants
        $save->addQuestProgress($progress);
        $save->discoverClue($this->clues['door_object']);

        $manager->persist($save);
    }
}
