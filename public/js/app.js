// Myth of Eden : petits comportements du site (menu mobile, barre du haut au défilement).
document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('[data-header]');
    const toggle = document.querySelector('[data-menu-toggle]');
    const menu = document.querySelector('[data-menu]');

    // La barre du haut devient opaque dès que l'on fait défiler la page.
    const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 20);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    // Ouverture / fermeture du menu sur petit écran.
    toggle?.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        menu?.classList.toggle('is-open', open);
    });

    menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
        toggle?.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
    }));
});
