/**
 * Myth of Eden : animations de la page d'accueil.
 * Utilise GSAP + ScrollTrigger et Lenis (chargés avant ce fichier) quand ils sont disponibles ;
 * la page reste entièrement lisible sans eux.
 */
(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

    /* ---------- Écran de chargement ---------- */

    const loader = document.querySelector('[data-loader]');
    let loaded = false;
    const finishLoading = () => {
        if (loaded) return;
        loaded = true;
        root.classList.add('is-loaded');
        loader?.classList.add('is-done');
        window.setTimeout(() => loader?.remove(), 1200);
    };
    window.addEventListener('portal:ready', () => window.setTimeout(finishLoading, 250));
    window.addEventListener('load', () => window.setTimeout(finishLoading, 1500));
    window.setTimeout(finishLoading, 3500); // filet de sécurité

    /* ---------- Défilement fluide ---------- */

    let lenis = null;
    if (!reducedMotion && typeof window.Lenis !== 'undefined') {
        lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
        if (hasGsap) {
            lenis.on('scroll', window.ScrollTrigger.update);
            window.gsap.ticker.add((time) => lenis.raf(time * 1000));
            window.gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
    }

    // Liens d'ancre de la page (#monde, /#classes…) : défilement doux.
    document.querySelectorAll('a[href*="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const url = new URL(link.href, window.location.href);
            if (url.pathname !== window.location.pathname || !url.hash) return;
            const target = document.querySelector(url.hash);
            if (!target) return;
            event.preventDefault();
            lenis ? lenis.scrollTo(target, { offset: -60 }) : target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    });

    /* ---------- Bannière : progression du défilement et parallaxe ---------- */

    const hero = document.querySelector('[data-hero]');
    if (hero) {
        const updateHero = () => {
            const rect = hero.getBoundingClientRect();
            const span = Math.max(1, rect.height - window.innerHeight);
            const progress = Math.min(1, Math.max(0, -rect.top / span));
            hero.style.setProperty('--p', progress.toFixed(4));
        };
        updateHero();
        window.addEventListener('scroll', updateHero, { passive: true });
        window.addEventListener('resize', updateHero);

        if (finePointer && !reducedMotion) {
            window.addEventListener('pointermove', (event) => {
                hero.style.setProperty('--mx', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
                hero.style.setProperty('--my', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
            }, { passive: true });
        }
    }

    /* ---------- Apparitions au défilement ---------- */

    const revealItems = document.querySelectorAll('[data-reveal]');
    if (reducedMotion) {
        revealItems.forEach((el) => el.classList.add('is-visible'));
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -12% 0px' });
        revealItems.forEach((el) => observer.observe(el));
    }

    /* ---------- Le monde : chapitres en défilement horizontal ---------- */

    const pin = document.querySelector('[data-world-pin]');
    const track = document.querySelector('[data-world-track]');
    const bar = document.querySelector('[data-world-progress]');
    if (hasGsap && pin && track && !reducedMotion) {
        const { gsap, ScrollTrigger } = window;
        gsap.registerPlugin(ScrollTrigger);

        gsap.matchMedia().add('(min-width: 900px)', () => {
                root.classList.add('world-horizontal');
                const distance = () => track.scrollWidth - window.innerWidth;

                // Fond en parallaxe : glisse à environ un quart de la vitesse du contenu
                // et passe en fondu d'une image de chapitre à la suivante.
                const backdrops = [...pin.querySelectorAll('[data-world-bg]')];
                const updateBackdrops = (progress) => {
                    const last = Math.max(1, backdrops.length - 1);
                    backdrops.forEach((img, i) => {
                        const opacity = Math.min(1, Math.max(0, 1 - Math.abs(progress * last - i) * 1.25));
                        img.style.opacity = opacity.toFixed(3);
                        img.style.transform = `translate3d(${(-progress * 8 + (i - progress * last) * 3).toFixed(2)}%, 0, 0) scale(${(1.08 + (1 - opacity) * 0.06).toFixed(3)})`;
                    });
                };
                updateBackdrops(0);
                const tween = gsap.to(track, {
                    x: () => -distance(),
                    ease: 'none',
                    scrollTrigger: {
                        trigger: pin,
                        start: 'top top',
                        end: () => '+=' + distance(),
                        pin: true,
                        scrub: 0.8,
                        invalidateOnRefresh: true,
                        onUpdate: (self) => {
                            if (bar) bar.style.transform = `scaleX(${self.progress})`;
                            updateBackdrops(self.progress);
                        },
                    },
                });

                // Léger mouvement des images à l'intérieur de chaque chapitre.
                track.querySelectorAll('.chapter__media img').forEach((img) => {
                    gsap.fromTo(img, { xPercent: -6 }, {
                        xPercent: 6,
                        ease: 'none',
                        scrollTrigger: { trigger: img.closest('.chapter'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
                    });
                });

            return () => root.classList.remove('world-horizontal');
        });

        window.addEventListener('load', () => ScrollTrigger.refresh());
    }

    /* ---------- Sélecteur de classes ---------- */

    const select = document.querySelector('[data-class-select]');
    if (select) {
        const tabs = [...select.querySelectorAll('[data-class-tab]')];
        const panels = [...select.querySelectorAll('[data-class-panel]')];
        const activate = (code, focus = false) => {
            tabs.forEach((tab) => {
                const active = tab.dataset.classTab === code;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
                if (active && focus) tab.focus();
            });
            panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.classPanel === code));
        };
        tabs.forEach((tab, index) => {
            tab.tabIndex = index === 0 ? 0 : -1;
            tab.addEventListener('click', () => activate(tab.dataset.classTab));
            if (finePointer) tab.addEventListener('mouseenter', () => activate(tab.dataset.classTab));
            tab.addEventListener('keydown', (event) => {
                const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
                if (!step) return;
                event.preventDefault();
                activate(tabs[(index + step + tabs.length) % tabs.length].dataset.classTab, true);
            });
        });
    }

    /* ---------- Micro-interactions (souris uniquement) ---------- */

    if (finePointer && !reducedMotion) {
        // Boutons « magnétiques » qui suivent légèrement le curseur.
        document.querySelectorAll('[data-magnetic]').forEach((el) => {
            el.addEventListener('pointermove', (event) => {
                const rect = el.getBoundingClientRect();
                const x = event.clientX - rect.left - rect.width / 2;
                const y = event.clientY - rect.top - rect.height / 2;
                el.style.transform = `translate(${x * 0.18}px, ${y * 0.25}px)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });

        // Cartes qui s'inclinent en 3D.
        document.querySelectorAll('[data-tilt]').forEach((el) => {
            el.addEventListener('pointermove', (event) => {
                const rect = el.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width - 0.5;
                const y = (event.clientY - rect.top) / rect.height - 0.5;
                el.style.setProperty('--rx', (y * -6).toFixed(2) + 'deg');
                el.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
                el.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(1) + '%');
                el.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(1) + '%');
            });
            el.addEventListener('pointerleave', () => {
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
            });
        });

        // Halo lumineux qui suit le curseur.
        const glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.appendChild(glow);
        window.addEventListener('pointermove', (event) => {
            glow.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        }, { passive: true });
    }
})();
