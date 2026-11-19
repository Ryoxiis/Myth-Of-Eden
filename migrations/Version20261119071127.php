<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261119071127 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE character_class (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(50) NOT NULL, name VARCHAR(80) NOT NULL, description LONGTEXT NOT NULL, advantages JSON NOT NULL, base_health SMALLINT NOT NULL, base_stamina SMALLINT NOT NULL, base_strength SMALLINT NOT NULL, base_agility SMALLINT NOT NULL, base_stealth SMALLINT NOT NULL, base_magic_mastery SMALLINT NOT NULL, base_tracking SMALLINT NOT NULL, UNIQUE INDEX UNIQ_CHARACTER_CLASS_CODE (code), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE clue (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, title VARCHAR(150) NOT NULL, description LONGTEXT NOT NULL, quest_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_CLUE_CODE (code), INDEX IDX_268AADD1209E9EF4 (quest_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE game_character (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(40) NOT NULL, appearance JSON NOT NULL, level SMALLINT NOT NULL, experience INT NOT NULL, unspent_stat_points SMALLINT NOT NULL, current_health SMALLINT NOT NULL, stat_health SMALLINT NOT NULL, stat_stamina SMALLINT NOT NULL, stat_strength SMALLINT NOT NULL, stat_agility SMALLINT NOT NULL, stat_stealth SMALLINT NOT NULL, stat_magic_mastery SMALLINT NOT NULL, stat_tracking SMALLINT NOT NULL, character_class_id INT NOT NULL, INDEX IDX_41DC7136B201E281 (character_class_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE game_save (id INT AUTO_INCREMENT NOT NULL, slot SMALLINT NOT NULL, zone VARCHAR(80) NOT NULL, position_x DOUBLE PRECISION NOT NULL, position_y DOUBLE PRECISION NOT NULL, position_z DOUBLE PRECISION NOT NULL, rotation_y DOUBLE PRECISION NOT NULL, play_time_seconds INT NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, owner_id INT NOT NULL, character_id INT NOT NULL, UNIQUE INDEX UNIQ_BE7356F21136BE75 (character_id), UNIQUE INDEX UNIQ_GAME_SAVE_OWNER_SLOT (owner_id, slot), INDEX IDX_BE7356F27E3C61F9 (owner_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE game_save_clue (game_save_id INT NOT NULL, clue_id INT NOT NULL, INDEX IDX_8BCCDBB6F5ECB864 (game_save_id), INDEX IDX_8BCCDBB6FCCE328B (clue_id), PRIMARY KEY (game_save_id, clue_id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE inventory_item (id INT AUTO_INCREMENT NOT NULL, quantity SMALLINT NOT NULL, equipped_slot VARCHAR(255) DEFAULT NULL, game_save_id INT NOT NULL, item_id INT NOT NULL, INDEX IDX_55BDEA30F5ECB864 (game_save_id), INDEX IDX_55BDEA30126F525E (item_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE item (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, description LONGTEXT NOT NULL, category VARCHAR(255) NOT NULL, equipment_slot VARCHAR(255) DEFAULT NULL, stackable TINYINT NOT NULL, max_stack SMALLINT NOT NULL, stat_bonuses JSON NOT NULL, effects JSON NOT NULL, model_path VARCHAR(255) DEFAULT NULL, UNIQUE INDEX UNIQ_ITEM_CODE (code), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE quest (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, title VARCHAR(150) NOT NULL, summary LONGTEXT NOT NULL, main TINYINT NOT NULL, experience_reward INT NOT NULL, UNIQUE INDEX UNIQ_QUEST_CODE (code), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE quest_progress (id INT AUTO_INCREMENT NOT NULL, status VARCHAR(255) NOT NULL, started_at DATETIME NOT NULL, completed_at DATETIME DEFAULT NULL, game_save_id INT NOT NULL, quest_id INT NOT NULL, current_step_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_QUEST_PROGRESS (game_save_id, quest_id), INDEX IDX_C35B4DE3F5ECB864 (game_save_id), INDEX IDX_C35B4DE3209E9EF4 (quest_id), INDEX IDX_C35B4DE3D9BF9B19 (current_step_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE quest_step (id INT AUTO_INCREMENT NOT NULL, position SMALLINT NOT NULL, code VARCHAR(80) NOT NULL, objective VARCHAR(255) NOT NULL, target_zone VARCHAR(80) DEFAULT NULL, quest_id INT NOT NULL, UNIQUE INDEX UNIQ_QUEST_STEP_CODE (quest_id, code), UNIQUE INDEX UNIQ_QUEST_STEP_POSITION (quest_id, position), INDEX IDX_4DB352CE209E9EF4 (quest_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE `user` (id INT AUTO_INCREMENT NOT NULL, email VARCHAR(180) NOT NULL, roles JSON NOT NULL, password VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_USER_EMAIL (email), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE clue ADD CONSTRAINT FK_268AADD1209E9EF4 FOREIGN KEY (quest_id) REFERENCES quest (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE game_character ADD CONSTRAINT FK_41DC7136B201E281 FOREIGN KEY (character_class_id) REFERENCES character_class (id)');
        $this->addSql('ALTER TABLE game_save ADD CONSTRAINT FK_BE7356F27E3C61F9 FOREIGN KEY (owner_id) REFERENCES `user` (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE game_save ADD CONSTRAINT FK_BE7356F21136BE75 FOREIGN KEY (character_id) REFERENCES game_character (id)');
        $this->addSql('ALTER TABLE game_save_clue ADD CONSTRAINT FK_8BCCDBB6F5ECB864 FOREIGN KEY (game_save_id) REFERENCES game_save (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE game_save_clue ADD CONSTRAINT FK_8BCCDBB6FCCE328B FOREIGN KEY (clue_id) REFERENCES clue (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE inventory_item ADD CONSTRAINT FK_55BDEA30F5ECB864 FOREIGN KEY (game_save_id) REFERENCES game_save (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE inventory_item ADD CONSTRAINT FK_55BDEA30126F525E FOREIGN KEY (item_id) REFERENCES item (id)');
        $this->addSql('ALTER TABLE quest_progress ADD CONSTRAINT FK_C35B4DE3F5ECB864 FOREIGN KEY (game_save_id) REFERENCES game_save (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE quest_progress ADD CONSTRAINT FK_C35B4DE3209E9EF4 FOREIGN KEY (quest_id) REFERENCES quest (id)');
        $this->addSql('ALTER TABLE quest_progress ADD CONSTRAINT FK_C35B4DE3D9BF9B19 FOREIGN KEY (current_step_id) REFERENCES quest_step (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE quest_step ADD CONSTRAINT FK_4DB352CE209E9EF4 FOREIGN KEY (quest_id) REFERENCES quest (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE clue DROP FOREIGN KEY FK_268AADD1209E9EF4');
        $this->addSql('ALTER TABLE game_character DROP FOREIGN KEY FK_41DC7136B201E281');
        $this->addSql('ALTER TABLE game_save DROP FOREIGN KEY FK_BE7356F27E3C61F9');
        $this->addSql('ALTER TABLE game_save DROP FOREIGN KEY FK_BE7356F21136BE75');
        $this->addSql('ALTER TABLE game_save_clue DROP FOREIGN KEY FK_8BCCDBB6F5ECB864');
        $this->addSql('ALTER TABLE game_save_clue DROP FOREIGN KEY FK_8BCCDBB6FCCE328B');
        $this->addSql('ALTER TABLE inventory_item DROP FOREIGN KEY FK_55BDEA30F5ECB864');
        $this->addSql('ALTER TABLE inventory_item DROP FOREIGN KEY FK_55BDEA30126F525E');
        $this->addSql('ALTER TABLE quest_progress DROP FOREIGN KEY FK_C35B4DE3F5ECB864');
        $this->addSql('ALTER TABLE quest_progress DROP FOREIGN KEY FK_C35B4DE3209E9EF4');
        $this->addSql('ALTER TABLE quest_progress DROP FOREIGN KEY FK_C35B4DE3D9BF9B19');
        $this->addSql('ALTER TABLE quest_step DROP FOREIGN KEY FK_4DB352CE209E9EF4');
        $this->addSql('DROP TABLE character_class');
        $this->addSql('DROP TABLE clue');
        $this->addSql('DROP TABLE game_character');
        $this->addSql('DROP TABLE game_save');
        $this->addSql('DROP TABLE game_save_clue');
        $this->addSql('DROP TABLE inventory_item');
        $this->addSql('DROP TABLE item');
        $this->addSql('DROP TABLE quest');
        $this->addSql('DROP TABLE quest_progress');
        $this->addSql('DROP TABLE quest_step');
        $this->addSql('DROP TABLE `user`');
    }
}
