import { runeIcon } from './ui/icons.js';

/**
 * Interface HTML superposée au canvas : chargement, quête, invites, notifications, sac, pause.
 * Aucune logique de jeu ici : main.js appelle ces méthodes.
 */
const CLASS_LABELS = { scout: 'Éclaireur', fighter: 'Combattant', traveler: 'Voyageur', mage: 'Mage' };
const ZONE_LABELS = { village: 'Village forestier', forest_path: 'Chemin de la forêt', ruin: 'Ruine oubliée' };
const TIER_LABELS = { elite: 'Élite', boss: 'Boss' };
const CLUE_LABELS = {
    door_object: 'Le pendentif porte le même symbole que la ruine de la légende.',
    forest_light_testimony: 'Une lumière bleue danse entre les arbres, du côté des vieilles pierres.',
};

export class Hud {
    constructor(root) {
        const $ = (selector) => root.querySelector(selector);
        this.root = root;
        this.el = {
            loading: $('[data-loading]'),
            loadingBar: $('[data-loading-bar]'),
            loadingStatus: $('[data-loading-status]'),
            start: $('[data-start]'),
            startButton: $('[data-start-button]'),
            hud: $('[data-hud]'),
            meta: $('[data-hud-meta]'),
            health: $('[data-hud-health]'),
            questBox: $('.hud-quest'),
            questTitle: $('[data-quest-title]'),
            questObjective: $('[data-quest-objective]'),
            saveIndicator: $('[data-save-indicator]'),
            toasts: $('[data-toasts]'),
            prompt: $('[data-prompt]'),
            floaters: $('[data-floaters]'),
            nameplates: $('[data-nameplates]'),
            runes: $('[data-runes]'),
            runesValue: $('[data-runes-value]'),
            target: $('[data-target]'),
            targetName: $('[data-target-name]'),
            targetBar: $('[data-target-bar]'),
            targetValue: $('[data-target-value]'),
            pause: $('[data-pause]'),
            pauseStatus: $('[data-pause-status]'),
            resume: $('[data-resume]'),
            save: $('[data-save]'),
            quit: $('[data-quit]'),
            quality: $('[data-quality]'),
            zone: $('[data-zone-label]'),
            stats: $('[data-stats]'),
            error: $('[data-error]'),
            errorMessage: $('[data-error-message]'),
            compass: $('[data-compass]'),
            compassTrack: $('[data-compass-track]'),
            compassGoal: $('[data-compass-goal]'),
            crosshair: $('[data-crosshair]'),
        };
        this.buildCompass();
        this.crosshairState = '';
        this.currentPrompt = null;
        this.newItemCode = null;
        this.floatersList = [];
        root.querySelector('[data-rune-icon]').innerHTML = runeIcon();
        this.zones = new Map();
        this.plates = new Map();
        this.target = null;
        this.targetTime = 0;
    }

    setLoading(progress, status) {
        this.el.loadingBar.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
        if (status) {
            this.el.loadingStatus.textContent = status;
        }
    }

    hideLoading() {
        this.el.loading.classList.add('is-done');
    }

    showStart(onStart) {
        this.el.start.hidden = false;
        this.el.startButton.focus();
        this.el.startButton.addEventListener('click', () => {
            this.el.start.hidden = true;
            this.el.hud.hidden = false;
            onStart();
        }, { once: true });
    }

    showError(message) {
        this.el.loading.classList.add('is-done');
        this.el.start.hidden = true;
        this.el.pause.hidden = true;
        this.el.errorMessage.textContent = message;
        this.el.error.hidden = false;
    }

    /** Met à jour tout ce qui dépend de l'état serveur. */
    render(state) {
        const character = state.character ?? {};
        this.el.meta.textContent = `${CLASS_LABELS[character.class] ?? 'Aventurier'} · niveau ${character.level ?? 1}`;
        const maxHealth = character.maxHealth ?? character.stats?.health ?? 100;
        const ratio = maxHealth > 0 ? (character.currentHealth ?? maxHealth) / maxHealth : 1;
        this.el.health.style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;

        const quest = (state.quests ?? []).find((q) => q.main) ?? state.quests?.[0];
        this.el.questTitle.textContent = quest?.title ?? 'Aucune quête';
        this.el.questObjective.textContent = quest?.currentStep?.objective
            ?? (quest?.status === 'completed' ? 'Quête terminée.' : 'Explorez les environs.');

    }

    setHealth(current, max) {
        this.el.health.style.width = `${Math.round(Math.min(1, current / max) * 100)}%`;
    }

    flashQuest() {
        this.el.questBox.classList.remove('is-updated');
        void this.el.questBox.offsetWidth; // relance l'animation
        this.el.questBox.classList.add('is-updated');
    }

    setPrompt(text) {
        if (text === this.currentPrompt) return;
        this.currentPrompt = text;
        this.el.prompt.hidden = !text;
        if (text) {
            this.el.prompt.innerHTML = '<kbd>E</kbd>';
            this.el.prompt.append(document.createTextNode(text));
        }
    }

    toast(title, text = '', variant = '') {
        const toast = document.createElement('div');
        toast.className = `hud-toast${variant ? ` hud-toast--${variant}` : ''}`;
        const heading = document.createElement('p');
        heading.className = 'hud-toast__title';
        heading.textContent = title;
        toast.append(heading);
        if (text) {
            const body = document.createElement('p');
            body.className = 'hud-toast__text';
            body.textContent = text;
            toast.append(body);
        }
        this.el.toasts.append(toast);
        setTimeout(() => {
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 400);
        }, 4200);
    }

    clueText(code) {
        return CLUE_LABELS[code] ?? 'Un nouvel indice a été ajouté à votre journal.';
    }

    showSaved(label = 'Partie sauvegardée') {
        const indicator = this.el.saveIndicator;
        indicator.textContent = label;
        indicator.classList.add('is-visible');
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => indicator.classList.remove('is-visible'), 2500);
    }

    /** Texte flottant au-dessus d'un point 3D (dégâts, soins…). */
    floatText(position, text, kind = 'damage') {
        const el = document.createElement('span');
        el.className = `floater floater--${kind}`;
        el.textContent = text;
        this.el.floaters.append(el);
        this.floatersList.push({ el, position: position.clone(), life: 0, drift: (Math.random() - 0.5) * 30 });
    }

    showTarget(target) {
        this.target = target;
        this.targetTime = 4;
        this.el.target.hidden = false;
        this.el.targetName.textContent = target.name;
    }

    /** project(vecteur 3D) → {x, y, visible} en pixels écran. */
    updateOverlays(dt, project) {
        this.floatersList = this.floatersList.filter((floater) => {
            floater.life += dt;
            const screen = project(floater.position);
            const t = floater.life / 1.1;
            floater.el.style.transform = `translate(calc(${screen.x + floater.drift * t}px - 50%), ${screen.y - t * 60}px) scale(${1 + Math.max(0, 0.3 - t)})`;
            floater.el.style.opacity = String(Math.max(0, 1 - t * t));
            floater.el.style.visibility = screen.visible ? 'visible' : 'hidden';
            if (t >= 1) {
                floater.el.remove();
                return false;
            }
            return true;
        });

        if (this.target) {
            this.targetTime -= dt;
            const ratio = this.target.hp / this.target.maxHp;
            this.el.targetBar.style.width = `${ratio * 100}%`;
            this.el.targetValue.textContent = `${Math.ceil(this.target.hp)} / ${this.target.maxHp}`;
            if (this.targetTime <= 0) {
                this.target = null;
                this.el.target.hidden = true;
            }
        }
    }

    /** Compteur de runes (petite animation quand il change). */
    setRunes(amount) {
        const previous = this.runes;
        this.runes = amount;
        this.el.runesValue.textContent = amount.toLocaleString('fr-FR');
        if (previous !== undefined && previous !== amount) {
            this.el.runes.classList.remove('is-gain', 'is-spend');
            void this.el.runes.offsetWidth;
            this.el.runes.classList.add(amount > previous ? 'is-gain' : 'is-spend');
        }
    }

    setZoneCatalog(zones) {
        for (const zone of zones) this.zones.set(zone.code, zone);
    }

    zoneInfo(code) {
        return this.zones.get(code) ?? null;
    }

    setZone(zone) {
        const info = this.zones.get(zone);
        this.el.zone.textContent = info
            ? `${info.name}${info.safe ? '' : ` · niv. ${info.minLevel}-${info.maxLevel}`}`
            : ZONE_LABELS[zone] ?? zone;
    }

    /** Barres de vie au-dessus des monstres proches. */
    updateNameplates(monsters, project, playerLevel = 1) {
        const seen = new Set();
        for (const monster of monsters) {
            const screen = project(monster.top);
            if (!screen.visible) continue;
            seen.add(monster);
            let plate = this.plates.get(monster);
            if (!plate) {
                const el = document.createElement('div');
                el.className = `nameplate nameplate--${monster.tier}`;
                el.innerHTML = '<p class="nameplate__name"></p><div class="nameplate__bar"><span></span></div>';
                this.el.nameplates.append(el);
                plate = { el, name: el.querySelector('.nameplate__name'), bar: el.querySelector('span') };
                this.plates.set(monster, plate);
            }
            const danger = monster.level - playerLevel;
            plate.el.classList.toggle('is-dangerous', danger >= 3);
            plate.name.textContent = `${TIER_LABELS[monster.tier] ? `${TIER_LABELS[monster.tier]} · ` : ''}${monster.name} · ${monster.level}`;
            plate.bar.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
            plate.el.style.transform = `translate(calc(${screen.x}px - 50%), calc(${screen.y}px - 100%))`;
        }
        for (const [monster, plate] of this.plates) {
            if (!seen.has(monster)) {
                plate.el.remove();
                this.plates.delete(monster);
            }
        }
    }

    hurt() {
        this.root.classList.remove('is-hurt');
        void this.root.offsetWidth;
        this.root.classList.add('is-hurt');
    }

    setQuality(current, levels) {
        this.el.quality.replaceChildren(...Object.entries(levels).map(([key, level]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = level.label;
            option.selected = key === current;
            return option;
        }));
    }

    get statsVisible() {
        return !this.el.stats.hidden;
    }

    toggleStats(force) {
        this.el.stats.hidden = !(force ?? this.el.stats.hidden);
    }

    renderStats(stats) {
        const rows = [
            ['FPS', `${stats.fps} (${stats.frame} ms)`],
            ['Appels de dessin', stats.drawCalls],
            ['Objets affichés', stats.meshes],
            ['Cases chargées', stats.cells],
            ['Objets en mémoire', stats.objects],
            ['Cases d\'herbe', stats.grass],
            ['Lampes actives', stats.lights],
            ['Monstres', stats.monsters],
            ['Zone', stats.zone],
        ];
        this.el.stats.textContent = rows.map(([label, value]) => `${label} : ${value}`).join('\n');
    }

    /* --- Boussole ------------------------------------------------------ */

    /** Graduations fixes : points cardinaux tous les 90°, intermédiaires tous les 45°, traits tous les 15°. */
    buildCompass() {
        const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
        this.compassMarks = [];
        for (let angle = 0; angle < 360; angle += 15) {
            const mark = document.createElement('span');
            const name = names[angle];
            mark.className = `hud-compass__mark${name ? (angle % 90 === 0 ? ' is-cardinal' : '') : ' is-tick'}${angle === 0 ? ' is-north' : ''}`;
            mark.textContent = name ?? '';
            this.el.compassTrack.append(mark);
            this.compassMarks.push({ angle, el: mark });
        }
        this.compassMarkers = new Map();
    }

    /**
     * Met à jour la boussole. `heading` : direction de la caméra en degrés (0 = nord, 90 = est).
     * `markers` : [{ id, bearing, kind, distance, label }] — bearing en degrés depuis le joueur.
     */
    updateCompass(heading, markers) {
        const half = 90; // la boussole montre 180° (90° de chaque côté)
        const place = (el, angle, clamp = false) => {
            let delta = ((angle - heading + 540) % 360) - 180;
            const outside = Math.abs(delta) > half;
            if (outside && !clamp) {
                el.style.display = 'none';
                return false;
            }
            if (outside) delta = Math.sign(delta) * half * 0.94;
            el.style.display = '';
            el.style.left = `${50 + (delta / half) * 50}%`;
            return outside;
        };
        for (const mark of this.compassMarks) place(mark.el, mark.angle);

        const seen = new Set();
        for (const marker of markers) {
            seen.add(marker.id);
            let el = this.compassMarkers.get(marker.id);
            if (!el) {
                el = document.createElement('span');
                el.className = `hud-compass__marker is-${marker.kind}`;
                this.el.compassTrack.append(el);
                this.compassMarkers.set(marker.id, el);
            }
            // L'objectif de quête reste toujours visible, collé au bord s'il est derrière.
            const edge = place(el, marker.bearing, marker.kind === 'quest');
            el.classList.toggle('is-edge', edge);
        }
        for (const [id, el] of this.compassMarkers) {
            if (!seen.has(id)) {
                el.remove();
                this.compassMarkers.delete(id);
            }
        }

        const quest = markers.find((marker) => marker.kind === 'quest');
        this.el.compassGoal.hidden = !quest;
        if (quest) {
            const text = `${quest.label} — <b>${Math.round(quest.distance)} m</b>`;
            if (this.el.compassGoal.innerHTML !== text) this.el.compassGoal.innerHTML = text;
        }
    }

    /* --- Réticule ------------------------------------------------------ */

    /** state : '' (neutre), 'enemy' (cible à portée), 'far' (rien à portée) ; hidden : masqué. */
    setCrosshair(state, { hidden = false, cooldown = false } = {}) {
        const el = this.el.crosshair;
        el.style.opacity = hidden ? '0' : '';
        if (state !== this.crosshairState) {
            el.classList.toggle('is-enemy', state === 'enemy');
            el.classList.toggle('is-far', state === 'far');
            this.crosshairState = state;
        }
        el.classList.toggle('is-cooldown', cooldown);
    }

    /** Petit « coup au but » : le réticule pivote un instant (doré sur un critique). */
    crosshairHit(critical = false) {
        const el = this.el.crosshair;
        el.classList.add('is-hit');
        el.classList.toggle('is-crit', critical);
        clearTimeout(this.hitTimer);
        this.hitTimer = setTimeout(() => el.classList.remove('is-hit', 'is-crit'), 130);
    }

    setPaused(paused) {
        this.el.pause.hidden = !paused;
        this.el.pauseStatus.textContent = '';
        if (paused) this.el.resume.focus();
    }

    setPauseStatus(text) {
        this.el.pauseStatus.textContent = text;
    }
}
