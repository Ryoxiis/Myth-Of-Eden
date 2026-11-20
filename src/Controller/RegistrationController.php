<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\RegistrationFormType;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

final class RegistrationController extends AbstractController
{
    #[Route('/inscription', name: 'app_register', methods: ['GET', 'POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
        Security $security,
    ): Response {
        if ($this->getUser()) {
            // Sans ce message, on croyait que l'inscription « ne marchait pas » (redirection muette).
            $this->addFlash('info', sprintf('Tu es déjà connecté avec %s. Déconnecte-toi pour créer un autre compte.', $this->getUser()->getUserIdentifier()));

            return $this->redirectToRoute('app_game_save_index');
        }

        $user = new User();
        $form = $this->createForm(RegistrationFormType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            /** @var string $plainPassword */
            $plainPassword = $form->get('plainPassword')->getData();
            $user->setPassword($passwordHasher->hashPassword($user, $plainPassword));

            $entityManager->persist($user);
            $entityManager->flush();

            $this->addFlash('success', 'Bienvenue ! Ton compte est créé.');

            // Connecte directement le nouveau joueur, puis l'envoie vers ses parties.
            return $security->login($user, 'form_login', 'main')
                ?? $this->redirectToRoute('app_game_save_index');
        }

        return $this->render('registration/register.html.twig', [
            'registrationForm' => $form,
        ]);
    }
}
