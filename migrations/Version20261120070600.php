<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261120070600 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE loot_chest (id INT AUTO_INCREMENT NOT NULL, monster_level SMALLINT NOT NULL, x DOUBLE PRECISION NOT NULL, z DOUBLE PRECISION NOT NULL, contents JSON NOT NULL, expires_at DATETIME NOT NULL, game_save_id INT NOT NULL, monster_id INT DEFAULT NULL, INDEX IDX_7AD97A5AF5ECB864 (game_save_id), INDEX IDX_7AD97A5AC5FF1223 (monster_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE merchant (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(100) NOT NULL, greeting VARCHAR(255) NOT NULL, x DOUBLE PRECISION NOT NULL, z DOUBLE PRECISION NOT NULL, buyback_rate DOUBLE PRECISION NOT NULL, zone_id INT NOT NULL, UNIQUE INDEX UNIQ_MERCHANT_CODE (code), INDEX IDX_74AB25E19F2C3FAB (zone_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE merchant_offer (id INT AUTO_INCREMENT NOT NULL, rarity VARCHAR(20) NOT NULL, price INT NOT NULL, position SMALLINT NOT NULL, merchant_id INT NOT NULL, item_id INT NOT NULL, INDEX IDX_BE455D796796D554 (merchant_id), INDEX IDX_BE455D79126F525E (item_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE monster (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(100) NOT NULL, tier VARCHAR(20) NOT NULL, model VARCHAR(60) NOT NULL, weapon VARCHAR(60) DEFAULT NULL, tint VARCHAR(7) DEFAULT NULL, scale DOUBLE PRECISION NOT NULL, base_health SMALLINT NOT NULL, base_damage SMALLINT NOT NULL, attack_range DOUBLE PRECISION NOT NULL, speed DOUBLE PRECISION NOT NULL, experience SMALLINT NOT NULL, population SMALLINT NOT NULL, zone_id INT NOT NULL, UNIQUE INDEX UNIQ_MONSTER_CODE (code), INDEX IDX_245EC6F49F2C3FAB (zone_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE skill (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(100) NOT NULL, description LONGTEXT NOT NULL, type VARCHAR(20) NOT NULL, required_level SMALLINT NOT NULL, position SMALLINT NOT NULL, cooldown DOUBLE PRECISION NOT NULL, cost SMALLINT NOT NULL, power SMALLINT NOT NULL, skill_range DOUBLE PRECISION NOT NULL, icon VARCHAR(40) NOT NULL, animation VARCHAR(60) NOT NULL, effect VARCHAR(40) NOT NULL, character_class_id INT NOT NULL, UNIQUE INDEX UNIQ_SKILL_CODE (code), INDEX IDX_5E3DE477B201E281 (character_class_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE zone (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(100) NOT NULL, description LONGTEXT NOT NULL, min_level SMALLINT NOT NULL, max_level SMALLINT NOT NULL, safe TINYINT NOT NULL, position SMALLINT NOT NULL, UNIQUE INDEX UNIQ_ZONE_CODE (code), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE loot_chest ADD CONSTRAINT FK_7AD97A5AF5ECB864 FOREIGN KEY (game_save_id) REFERENCES game_save (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE loot_chest ADD CONSTRAINT FK_7AD97A5AC5FF1223 FOREIGN KEY (monster_id) REFERENCES monster (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE merchant ADD CONSTRAINT FK_74AB25E19F2C3FAB FOREIGN KEY (zone_id) REFERENCES zone (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE merchant_offer ADD CONSTRAINT FK_BE455D796796D554 FOREIGN KEY (merchant_id) REFERENCES merchant (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE merchant_offer ADD CONSTRAINT FK_BE455D79126F525E FOREIGN KEY (item_id) REFERENCES item (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE monster ADD CONSTRAINT FK_245EC6F49F2C3FAB FOREIGN KEY (zone_id) REFERENCES zone (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE skill ADD CONSTRAINT FK_5E3DE477B201E281 FOREIGN KEY (character_class_id) REFERENCES character_class (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE game_save ADD skill_bar JSON DEFAULT NULL, ADD runes INT DEFAULT 0 NOT NULL, ADD last_victory_at DATETIME DEFAULT NULL');
        $this->addSql('ALTER TABLE inventory_item ADD rarity VARCHAR(20) DEFAULT \'common\' NOT NULL, ADD item_level SMALLINT DEFAULT 1 NOT NULL, ADD rolled_bonuses JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE item ADD lootable TINYINT DEFAULT 0 NOT NULL, ADD drop_level SMALLINT DEFAULT 1 NOT NULL, ADD price INT DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE loot_chest DROP FOREIGN KEY FK_7AD97A5AF5ECB864');
        $this->addSql('ALTER TABLE loot_chest DROP FOREIGN KEY FK_7AD97A5AC5FF1223');
        $this->addSql('ALTER TABLE merchant DROP FOREIGN KEY FK_74AB25E19F2C3FAB');
        $this->addSql('ALTER TABLE merchant_offer DROP FOREIGN KEY FK_BE455D796796D554');
        $this->addSql('ALTER TABLE merchant_offer DROP FOREIGN KEY FK_BE455D79126F525E');
        $this->addSql('ALTER TABLE monster DROP FOREIGN KEY FK_245EC6F49F2C3FAB');
        $this->addSql('ALTER TABLE skill DROP FOREIGN KEY FK_5E3DE477B201E281');
        $this->addSql('DROP TABLE loot_chest');
        $this->addSql('DROP TABLE merchant');
        $this->addSql('DROP TABLE merchant_offer');
        $this->addSql('DROP TABLE monster');
        $this->addSql('DROP TABLE skill');
        $this->addSql('DROP TABLE zone');
        $this->addSql('ALTER TABLE game_save DROP skill_bar, DROP runes, DROP last_victory_at');
        $this->addSql('ALTER TABLE inventory_item DROP rarity, DROP item_level, DROP rolled_bonuses');
        $this->addSql('ALTER TABLE item DROP lootable, DROP drop_level, DROP price');
    }
}
