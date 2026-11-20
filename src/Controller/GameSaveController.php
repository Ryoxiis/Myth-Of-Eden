<?php

namespace App\Controller;

use App\Entity\GameSave;
use App\Entity\User;
use App\Form\CharacterCreationType;
use App\Form\Model\NewCharacterData;
use App\Repository\GameSaveRepository;
use App\Security\Voter\GameSaveVoter;
use App\Service\GameSaveFactory;
use App\Service\GameSaveSummary;
use App\Service\SkillBook;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Doctrine\Attribute\MapEntity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/parties')]
#[IsGranted('ROLE_USER')]
final class GameSaveController extends AbstractController
{
    /**
     * Liste les emplacements de partie du joueur connecté (occupés ou libres).
     */
    #[Route('', name: 'app_game_save_index', methods: ['GET'])]
    public function index(GameSaveRepository $gameSaveRepository): Response
    {
        $user = $this->getPlayer();

        $savesBySlot = [];
        foreach ($gameSaveRepository->findForOwner($user) as $save) {
            $savesBySlot[$save->getSlot()] = $save;
        }

        /** @var array<int, GameSave|null> $slots */
        $slots = [];
        for ($slot = 1; $slot <= User::MAX_GAME_SAVES; ++$slot) {
            $slots[$slot] = $savesBySlot[$slot] ?? null;
        }

        return $this->render('game_save/index.html.twig', [
            'slots' => $slots,
        ]);
    }

    /**
     * Crée un personnage dans un emplacement libre, puis la partie qui va avec.
     */
    #[Route('/nouvelle/{slot}', name: 'app_game_save_new', requirements: ['slot' => '\d+'], methods: ['GET', 'POST'])]
    public function new(
        int $slot,
        Request $request,
        GameSaveRepository $gameSaveRepository,
        GameSaveFactory $gameSaveFactory,
        EntityManagerInterface $entityManager,
    ): Response {
        $user = $this->getPlayer();

        if ($slot < 1 || $slot > User::MAX_GAME_SAVES) {
            throw $this->createNotFoundException('Cet emplacement n\'existe pas.');
        }

        if (null !== $gameSaveRepository->findOneBy(['owner' => $user, 'slot' => $slot])) {
            $this->addFlash('error', sprintf('L\'emplacement %d est déjà occupé.', $slot));

            return $this->redirectToRoute('app_game_save_index');
        }

        $data = new NewCharacterData();
        $form = $this->createForm(CharacterCreationType::class, $data);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $gameSave = $gameSaveFactory->create($user, $slot, $data);
            $entityManager->persist($gameSave);
            $entityManager->flush();

            $this->addFlash('success', sprintf('%s est prêt·e pour l\'aventure !', $gameSave->getDisplayName()));

            return $this->redirectToRoute('app_game_save_show', ['id' => $gameSave->getId()]);
        }

        return $this->render('game_save/new.html.twig', [
            'form' => $form,
            'slot' => $slot,
            'skinTones' => NewCharacterData::SKIN_TONES,
            'hairColors' => NewCharacterData::HAIR_COLORS,
        ]);
    }

    /**
     * Fiche de la partie : personnage, progression, équipement, sac et journal de quêtes.
     */
    #[Route('/{id}', name: 'app_game_save_show', requirements: ['id' => '\d+'], methods: ['GET'])]
    #[IsGranted(GameSaveVoter::MANAGE, 'gameSave')]
    public function show(#[MapEntity(id: 'id')] GameSave $gameSave, GameSaveSummary $summary, SkillBook $skillBook): Response
    {
        return $this->render('game_save/show.html.twig', [
            'save' => $gameSave,
            'character' => $gameSave->getCharacter(),
            'summary' => $summary->summarize($gameSave),
            'skills' => $skillBook->skillsFor($gameSave),
            'skillBar' => $skillBook->barFor($gameSave),
        ]);
    }

    /**
     * Confirmation puis suppression d'une partie. Le joueur doit retaper le nom du personnage.
     */
    #[Route('/{id}/supprimer', name: 'app_game_save_delete', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    #[IsGranted(GameSaveVoter::MANAGE, 'gameSave')]
    public function delete(
        #[MapEntity(id: 'id')] GameSave $gameSave,
        Request $request,
        EntityManagerInterface $entityManager,
    ): Response {
        $name = $gameSave->getDisplayName();
        $error = null;

        if ($request->isMethod('POST')) {
            $typedName = trim((string) $request->request->get('confirm_name'));

            if (!$this->isCsrfTokenValid('delete-save-'.$gameSave->getId(), (string) $request->request->get('_token'))) {
                $error = 'Le formulaire a expiré. Merci de réessayer.';
            } elseif (0 !== strcasecmp($typedName, $name)) {
                $error = sprintf('Tape exactement « %s » pour confirmer.', $name);
            } else {
                $slot = $gameSave->getSlot();
                $entityManager->remove($gameSave);
                $entityManager->flush();

                $this->addFlash('success', sprintf('La partie « %s » (emplacement %d) a été supprimée.', $name, $slot));

                return $this->redirectToRoute('app_game_save_index');
            }
        }

        return $this->render('game_save/delete.html.twig', [
            'save' => $gameSave,
            'error' => $error,
        ], new Response(status: null === $error ? 200 : 422));
    }

    private function getPlayer(): User
    {
        $user = $this->getUser();

        if (!$user instanceof User) {
            throw $this->createAccessDeniedException();
        }

        return $user;
    }
}
