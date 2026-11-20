/**
 * Interface HTML superposée au canvas : chargement, quête, invites, notifications, sac, pause.
 * Aucune logique de jeu ici : main.js appelle ces méthodes.
 */
const CLASS_LABELS = { scout: 'Éclaireur', fighter: 'Combattant', traveler: 'Voyageur', mage: 'Mage' };
const ZONE_LABELS = { village: 'Village forestier', forest_path: 'Chemin de la forêt', ruin: 'Ruine oubliée' };
const CLUE_LABELS = { door_object: 'Le pendentif porte le même symbole que la ruine de la légende.' };

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
            bag: $('[data-bag]'),
            bagList: $('[data-bag-list]'),
            bagClose: $('[data-bag-close]'),
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
        };
        this.currentPrompt = null;
        this.newItemCode = null;
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
        const maxHealth = character.stats?.health ?? character.currentHealth ?? 100;
        const ratio = maxHealth > 0 ? (character.currentHealth ?? maxHealth) / maxHealth : 1;
        this.el.health.style.width = `${Math.round(Math.min(1, ratio) * 100)}%`;

        const quest = (state.quests ?? []).find((q) => q.main) ?? state.quests?.[0];
        this.el.questTitle.textContent = quest?.title ?? 'Aucune quête';
        this.el.questObjective.textContent = quest?.currentStep?.objective
            ?? (quest?.status === 'completed' ? 'Quête terminée.' : 'Explorez les environs.');

        this.renderBag(state.inventory ?? []);
    }

    flashQuest() {
        this.el.questBox.classList.remove('is-updated');
        void this.el.questBox.offsetWidth; // relance l'animation
        this.el.questBox.classList.add('is-updated');
    }

    renderBag(items) {
        this.el.bagList.replaceChildren(...items.map((item) => {
            const li = document.createElement('li');
            li.className = 'hud-bag__item';
            if (item.category === 'quest') li.classList.add('is-quest');
            if (item.code === this.newItemCode) li.classList.add('is-new');

            const name = document.createElement('span');
            name.textContent = item.name;
            const info = document.createElement('small');
            info.textContent = item.equippedSlot ? 'équipé' : `×${item.quantity}`;
            li.append(name, info);
            return li;
        }));
    }

    toggleBag(force) {
        const open = force ?? this.el.bag.hidden;
        this.el.bag.hidden = !open;
        return open;
    }

    get bagOpen() {
        return !this.el.bag.hidden;
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

    setZone(zone) {
        this.el.zone.textContent = ZONE_LABELS[zone] ?? zone;
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
            ['Zone', stats.zone],
        ];
        this.el.stats.textContent = rows.map(([label, value]) => `${label} : ${value}`).join('\n');
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
