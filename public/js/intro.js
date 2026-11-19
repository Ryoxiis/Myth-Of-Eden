/**
 * Myth of Eden : cinématique d'entrée.
 * Le défilement rapproche la caméra du portail (voir portal.js), des sous-titres apparaissent,
 * puis la caméra traverse le vortex : flash, et redirection vers la connexion (ou les parties).
 */
(() => {
    const intro = document.querySelector('[data-intro]');
    if (!intro) return;

    const destination = intro.dataset.destination || '/connexion';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const captions = [...intro.querySelectorAll('[data-caption]')];
    const enterButton = intro.querySelector('[data-intro-enter]');
    const skipLink = intro.querySelector('[data-intro-skip]');
    const ENTER_AT = 0.97;

    let entering = false;
    let autoplay = false;

    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    /* ---------- Défilement fluide ---------- */

    let lenis = null;
    if (!reducedMotion && typeof window.Lenis !== 'undefined') {
        lenis = new window.Lenis({ lerp: 0.07, smoothWheel: true, wheelMultiplier: 0.9 });
        const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
    }

    const maxScroll = () => Math.max(0, intro.offsetHeight - window.innerHeight);

    /* ---------- Entrée dans le portail ---------- */

    const enter = () => {
        if (entering) return;
        entering = true;
        intro.classList.add('is-entering');
        try { sessionStorage.setItem('portal-entered', '1'); } catch (e) {}
        window.setTimeout(() => window.location.assign(destination), 650);
    };

    /* ---------- Progression ---------- */

    const fade = (p, from, to) => {
        const edge = 0.05;
        if (p < from - edge || p > to + edge) return 0;
        if (p < from) return (p - (from - edge)) / edge;
        if (p > to) return 1 - (p - to) / edge;
        return 1;
    };

    const update = () => {
        const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, maxScroll())));
        intro.style.setProperty('--p', p.toFixed(4));

        captions.forEach((caption) => {
            const o = fade(p, Number(caption.dataset.from), Number(caption.dataset.to));
            caption.style.opacity = o.toFixed(3);
            caption.style.transform = `translate(-50%, ${((1 - o) * 18).toFixed(1)}px) scale(${(0.97 + o * 0.03).toFixed(3)})`;
        });

        if (p >= ENTER_AT) {
            enter();
        }
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    /* ---------- Bouton « Entrer » : joue la cinématique tout seul ---------- */

    const playCinematic = () => {
        if (reducedMotion) {
            enter();
            return;
        }
        if (autoplay) return;
        autoplay = true;
        intro.classList.add('is-autoplay');

        if (lenis) {
            lenis.scrollTo(maxScroll(), {
                duration: 7,
                easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
                lock: true,
                force: true,
            });
        } else {
            const start = performance.now();
            const from = window.scrollY;
            const to = maxScroll();
            const step = (now) => {
                const t = Math.min(1, (now - start) / 7000);
                const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                window.scrollTo(0, from + (to - from) * e);
                if (t < 1 && !entering) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }
    };

    enterButton?.addEventListener('click', playCinematic);

    skipLink?.addEventListener('click', (event) => {
        event.preventDefault();
        enter();
    });

    /* ---------- Retour arrière depuis la page suivante ---------- */

    const reset = () => {
        entering = false;
        autoplay = false;
        intro.classList.remove('is-entering', 'is-autoplay');
        lenis ? lenis.scrollTo(0, { immediate: true, force: true }) : window.scrollTo(0, 0);
        update();
    };

    window.addEventListener('pageshow', (event) => {
        if (event.persisted || window.scrollY > 0) {
            reset();
        }
    });

    if (window.scrollY > 0) {
        window.scrollTo(0, 0);
    }

    update();
})();
