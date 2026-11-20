<?php

namespace App\Service;

use App\Entity\GameSave;
use App\Entity\Skill;
use App\Repository\SkillRepository;

/**
 * Le grimoire : compétences de la classe du personnage (débloquées ou non selon son niveau)
 * et gestion de la barre de compétences.
 */
final class SkillBook
{
    public function __construct(private readonly SkillRepository $skillRepository)
    {
    }

    /** @return list<Skill> toutes les compétences de la classe, dans l'ordre du grimoire */
    public function skillsFor(GameSave $gameSave): array
    {
        $class = $gameSave->getCharacter()?->getCharacterClass();

        return null === $class ? [] : $this->skillRepository->findForClass($class);
    }

    /** @return list<array<string, mixed>> compétences prêtes pour l'API (avec l'état « débloquée ») */
    public function export(GameSave $gameSave): array
    {
        $level = $gameSave->getCharacter()?->getLevel() ?? 1;

        return array_map(static fn (Skill $skill) => [
            'code' => $skill->getCode(),
            'name' => $skill->getName(),
            'description' => $skill->getDescription(),
            'type' => $skill->getType()->value,
            'typeLabel' => $skill->getType()->label(),
            'offensive' => $skill->getType()->isOffensive(),
            'requiredLevel' => $skill->getRequiredLevel(),
            'unlocked' => $skill->isUnlockedAt($level),
            'cooldown' => $skill->getCooldown(),
            'cost' => $skill->getCost(),
            'power' => $skill->getPower(),
            'range' => $skill->getRange(),
            'icon' => $skill->getIcon(),
            'animation' => $skill->getAnimation(),
            'effect' => $skill->getEffect(),
        ], $this->skillsFor($gameSave));
    }

    /**
     * Barre actuelle ; pour une ancienne partie jamais configurée, barre par défaut
     * (les premières compétences débloquées).
     *
     * @return list<string|null>
     */
    public function barFor(GameSave $gameSave): array
    {
        return $gameSave->hasSkillBar() ? $gameSave->getSkillBar() : $this->defaultBar($gameSave);
    }

    /** @return list<string|null> */
    public function defaultBar(GameSave $gameSave): array
    {
        $level = $gameSave->getCharacter()?->getLevel() ?? 1;
        $codes = [];
        foreach ($this->skillsFor($gameSave) as $skill) {
            if ($skill->isUnlockedAt($level) && \count($codes) < GameSave::SKILL_BAR_SIZE) {
                $codes[] = $skill->getCode();
            }
        }

        return array_pad($codes, GameSave::SKILL_BAR_SIZE, null);
    }

    /**
     * Enregistre une nouvelle barre après vérification de chaque emplacement.
     *
     * @param array<mixed> $slots
     *
     * @throws \InvalidArgumentException message affichable au joueur
     */
    public function assignBar(GameSave $gameSave, array $slots): void
    {
        if (!array_is_list($slots) || \count($slots) !== GameSave::SKILL_BAR_SIZE) {
            throw new \InvalidArgumentException(\sprintf('La barre doit contenir exactement %d emplacements.', GameSave::SKILL_BAR_SIZE));
        }

        $level = $gameSave->getCharacter()?->getLevel() ?? 1;
        $known = [];
        foreach ($this->skillsFor($gameSave) as $skill) {
            $known[(string) $skill->getCode()] = $skill;
        }

        $seen = [];
        foreach ($slots as $code) {
            if (null === $code) {
                continue;
            }
            if (!\is_string($code) || !isset($known[$code])) {
                throw new \InvalidArgumentException('Cette compétence n\'appartient pas à votre classe.');
            }
            if (!$known[$code]->isUnlockedAt($level)) {
                throw new \InvalidArgumentException(\sprintf('« %s » se débloque au niveau %d.', $known[$code]->getName(), $known[$code]->getRequiredLevel()));
            }
            if (isset($seen[$code])) {
                throw new \InvalidArgumentException('Une compétence ne peut occuper qu\'un seul emplacement.');
            }
            $seen[$code] = true;
        }

        $gameSave->setSkillBar($slots);
    }
}
