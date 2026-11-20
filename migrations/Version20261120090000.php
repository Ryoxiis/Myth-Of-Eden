<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * PNJ avec qui l'on peut parler (Oldin) : table `npc`.
 */
final class Version20261120090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute les PNJ (table npc) : position, modèle, dialogues et étape de quête.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE npc (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(80) NOT NULL, name VARCHAR(100) NOT NULL, title VARCHAR(100) NOT NULL, x DOUBLE PRECISION NOT NULL, z DOUBLE PRECISION NOT NULL, rotation DOUBLE PRECISION NOT NULL, model VARCHAR(60) NOT NULL, tint VARCHAR(7) DEFAULT NULL, quest_step_code VARCHAR(80) DEFAULT NULL, quest_dialogue JSON NOT NULL, idle_dialogue JSON NOT NULL, zone_id INT NOT NULL, clue_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_NPC_CODE (code), INDEX IDX_468C762C9F2C3FAB (zone_id), INDEX IDX_468C762CFCCE328B (clue_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE npc ADD CONSTRAINT FK_468C762C9F2C3FAB FOREIGN KEY (zone_id) REFERENCES zone (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE npc ADD CONSTRAINT FK_468C762CFCCE328B FOREIGN KEY (clue_id) REFERENCES clue (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE npc DROP FOREIGN KEY FK_468C762C9F2C3FAB');
        $this->addSql('ALTER TABLE npc DROP FOREIGN KEY FK_468C762CFCCE328B');
        $this->addSql('DROP TABLE npc');
    }
}
