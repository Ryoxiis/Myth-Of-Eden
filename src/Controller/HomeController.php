<?php

namespace App\Controller;

use App\Content\HomeContent;
use App\Entity\User;
use App\Form\RegistrationFormType;
use App\Repository\CharacterClassRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class HomeController extends AbstractController
{
    /**
     * Cinématique d'entrée : le portail 3D. En le franchissant, le visiteur arrive
     * sur la connexion (ou sur ses parties s'il est déjà connecté).
     */
    #[Route('/', name: 'app_home', methods: ['GET'])]
    public function intro(): Response
    {
        return $this->render('home/intro.html.twig', [
            'destination' => $this->getUser()
                ? $this->generateUrl('app_game_save_index')
                : $this->generateUrl('app_login'),
        ]);
    }

    /**
     * Présentation du jeu : histoire, classes, actualités, inscription et FAQ.
     */
    #[Route('/decouvrir', name: 'app_discover', methods: ['GET'])]
    public function discover(CharacterClassRepository $characterClassRepository, HomeContent $content): Response
    {
        // Formulaire d'inscription affiché aux visiteurs ; il est traité par RegistrationController.
        $registrationForm = $this->getUser() ? null : $this->createForm(RegistrationFormType::class, new User(), [
            'action' => $this->generateUrl('app_register'),
        ]);

        return $this->render('home/index.html.twig', [
            'classes' => $characterClassRepository->findBy([], ['id' => 'ASC']),
            'news' => $content->getNews(),
            'chapters' => $content->getChapters(),
            'faq' => $content->getFaq(),
            'registrationForm' => $registrationForm,
        ]);
    }
}
