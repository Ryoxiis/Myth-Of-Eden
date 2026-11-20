/**
 * Client de l'API JSON Symfony (/api/parties/{id}).
 * La session (cookie) authentifie les requêtes : elles partent toutes du même domaine.
 */
export class GameApi {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async request(path, { method = 'GET', body = null, keepalive = false } = {}) {
        const headers = { Accept: 'application/json' };
        if (body !== null) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(this.baseUrl + path, {
            method,
            headers,
            credentials: 'same-origin',
            body: body === null ? null : JSON.stringify(body),
            keepalive,
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            // Réponse vide ou non JSON (ex. page de connexion après expiration de session).
        }

        if (!response.ok || data === null) {
            const expired = response.redirected && response.url.includes('/connexion');
            const message = data?.error ?? (expired ? 'Session expirée, reconnecte-toi.' : `Erreur serveur (${response.status}).`);
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    /** Données du monde (zones, monstres, raretés), communes à toutes les parties. */
    async world(url) {
        const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Monde indisponible (${response.status}).`);
        return response.json();
    }

    /** État complet de la partie (personnage, sac, quêtes, position). */
    load() {
        return this.request('');
    }

    /** Ramasse un objet : renvoie l'objet ajouté, l'avancement de quête et le nouvel état. */
    pickUp(itemCode, quantity = 1) {
        return this.request('/objets/ramasser', { method: 'POST', body: { item: itemCode, quantity } });
    }

    /** Utilise un consommable du sac (identifiant de la ligne d'inventaire). */
    useItem(entryId) {
        return this.request(`/objets/${entryId}/utiliser`, { method: 'POST', body: {} });
    }

    /** Équipe ou retire un objet. */
    equipItem(entryId) {
        return this.request(`/objets/${entryId}/equiper`, { method: 'POST', body: {} });
    }

    /** Enregistre la barre de compétences (6 codes ou null). */
    saveSkillBar(slots) {
        return this.request('/competences/barre', { method: 'POST', body: { slots } });
    }

    /** Victoire sur un monstre : expérience, niveaux et coffre de butin tirés par le serveur. */
    victory(monster, level, position) {
        return this.request('/combat/victoire', { method: 'POST', body: { monster, level, position: { x: +position.x.toFixed(2), z: +position.z.toFixed(2) } } });
    }

    /** Prend un objet d'un coffre (index) ou tout ce qui rentre dans le sac (index null). */
    takeFromChest(chestId, index = null) {
        return this.request(`/coffres/${chestId}/prendre`, { method: 'POST', body: index === null ? { all: true } : { index } });
    }

    /** Achète un article chez un marchand. */
    buy(merchantCode, offerId, quantity = 1) {
        return this.request(`/marchands/${merchantCode}/acheter`, { method: 'POST', body: { offer: offerId, quantity } });
    }

    /** Vend une ligne du sac à un marchand. */
    sell(merchantCode, entryId, quantity = 1) {
        return this.request(`/marchands/${merchantCode}/vendre`, { method: 'POST', body: { entry: entryId, quantity } });
    }

    /** Parle à un PNJ : répliques, et avancée de quête s'il y a lieu. */
    talk(npcCode, position) {
        return this.request(`/pnj/${npcCode}/parler`, { method: 'POST', body: { position: { x: +position.x.toFixed(2), z: +position.z.toFixed(2) } } });
    }

    /** Sauvegarde la position et le temps joué depuis la dernière sauvegarde. */
    save(payload, { keepalive = false } = {}) {
        return this.request('/sauvegarde', { method: 'POST', body: payload, keepalive });
    }
}
