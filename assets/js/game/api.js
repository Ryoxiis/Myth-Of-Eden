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
            const error = new Error(data?.error ?? `Erreur serveur (${response.status}).`);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    /** État complet de la partie (personnage, sac, quêtes, position). */
    load() {
        return this.request('');
    }

    /** Ramasse un objet : renvoie l'objet ajouté, l'avancement de quête et le nouvel état. */
    pickUp(itemCode, quantity = 1) {
        return this.request('/objets/ramasser', { method: 'POST', body: { item: itemCode, quantity } });
    }

    /** Sauvegarde la position et le temps joué depuis la dernière sauvegarde. */
    save(payload, { keepalive = false } = {}) {
        return this.request('/sauvegarde', { method: 'POST', body: payload, keepalive });
    }
}
