# services/http — implémentation FastAPI à venir (J9-J13)

Vide en V1. En V2, créer ici une implémentation des interfaces de `../api.ts` :

- `IncidentsApi` : `GET /incidents`, `PATCH /incidents/{id}` (statut + `alert_logs`), `subscribe` via WebSocket.
- `AuthApi` : ID token Firebase envoyé à FastAPI (vérifié côté serveur, rôle `admin` par custom claim).
- `SosApi` : `POST /sos`.

Puis exposer cette implémentation dans `../index.ts` quand `VITE_DATA_MODE=http`.
Aucun écran n'a besoin d'être modifié.
