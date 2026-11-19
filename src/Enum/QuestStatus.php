<?php

namespace App\Enum;

enum QuestStatus: string
{
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::InProgress => 'En cours',
            self::Completed => 'Terminée',
            self::Failed => 'Échouée',
        };
    }
}
