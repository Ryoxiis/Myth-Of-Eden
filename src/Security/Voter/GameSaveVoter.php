<?php

namespace App\Security\Voter;

use App\Entity\GameSave;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * Un joueur ne peut consulter, reprendre ou supprimer que ses propres parties.
 *
 * @extends Voter<string, GameSave>
 */
final class GameSaveVoter extends Voter
{
    public const MANAGE = 'GAME_SAVE_MANAGE';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return self::MANAGE === $attribute && $subject instanceof GameSave;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var GameSave $subject */
        return $subject->getOwner()?->getId() === $user->getId();
    }
}
