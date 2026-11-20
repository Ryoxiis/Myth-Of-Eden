<?php

namespace App\Command;

use App\Service\NpcInstaller;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * php bin/console app:pnj:installer
 * Ajoute (ou met à jour) les PNJ sans effacer les comptes ni les parties.
 */
#[AsCommand(name: 'app:pnj:installer', description: 'Crée ou met à jour les PNJ (Oldin…) sans toucher aux comptes ni aux parties.')]
final class InstallNpcsCommand extends Command
{
    public function __construct(
        private readonly NpcInstaller $installer,
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $codes = $this->installer->install();
        $this->entityManager->flush();

        if ([] === $codes) {
            $io->warning('Aucun PNJ installé : les zones n\'existent pas encore (chargez d\'abord les données du monde).');

            return Command::FAILURE;
        }
        $io->success(sprintf('PNJ prêts : %s.', implode(', ', $codes)));

        return Command::SUCCESS;
    }
}
