# Vigilis

Plateforme de détection et de signalement des situations à risque (violence, chute / malaise, SOS ; vol expérimental). Le système détecte tôt et alerte vite ; il ne prédit pas.

**Version actuelle : V1.1 (vues globales admin et utilisateur), toujours en démo statique.** Voir [CHANGELOG.md](CHANGELOG.md). 100 % dans le navigateur : aucune API, aucun Firebase, aucun backend, aucun modèle IA. Toutes les données sont simulées.

## Lancer
```bash
cd web
npm install
npm run dev        # développement
npm run build && npm run preview   # version de production (PWA, hors ligne)
npm test           # tests (moteur de décision, services mock)
```
Variables (voir `web/.env.example`) : `VITE_DATA_MODE=mock`, `VITE_DEMO_CENTER=lat,lng` (défaut : Lagos).

## Mode connecté (backend FastAPI + Firestore réels)
Prérequis : `backend/.env` (voir `backend/.env.example`) et la clé de compte de service **hors du dépôt**.
```bash
# terminal 1 : backend (http://localhost:8000)
cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
# terminal 2 : frontend connecté (http://localhost:5173)
cd web && npm run dev:live
```
Connexion avec un vrai compte Firebase (le rôle `admin` est posé avec `python -m scripts.set_role <email> admin`). L'admin voit tous les incidents et peut les prendre en charge ou les clôturer ; l'utilisateur voit les siens. Actualisation toutes les 2,5 s (le WebSocket n'est pas encore fait). Caméras, santé détaillée, simulateur et statistiques de caméra restent vides ou désactivés tant que le service IA n'est pas branché.

## Service IA (détection de chute par webcam)
Prérequis : `ai/.env` (voir `ai/.env.example`, clé = `AI_API_KEY` de `backend/.env`) et le modèle `ai/models/yolo26n-pose.pt` (non versionné).
```bash
cd ai
venv\Scripts\python.exe -m vigilis_ai.view --source 0 --fall --confirm-s 5          # voir la détection en direct
venv\Scripts\python.exe -m vigilis_ai.view --source 0 --fall --send --confirm-s 5   # et envoyer les chutes au backend
venv\Scripts\python.exe -m vigilis_ai.view --source 0 --fall --violence --send --confirm-s 5   # chute + violence (modèle ai/models/videomae_best.pt, non versionné)
venv\Scripts\python.exe -m vigilis_ai.record --name chute_1 --seconds 40            # enregistrer les POINTS du corps (jamais d'image)
venv\Scripts\python.exe -m vigilis_ai.replay data\pose_records\chute_1.csv          # rejouer avec d'autres seuils
venv\Scripts\python.exe -m vigilis_ai.evaluate data\videos --csv-out data\resultats.csv   # évaluer un dossier de vidéos
```
Évaluation : mettez vos vidéos dans `ai/data/videos/` ; le résultat attendu vient du nom (`chute_immobile_*` ou `alerte_*` = alerte attendue, tout le reste = aucune) ou d'un `labels.csv` (`file,expected`). Le tableau donne chutes détectées, fausses alertes et chutes manquées ; la pose est mise en cache (changer un seuil prend quelques secondes). Ne mettez pas `--send` avec des fichiers.
Webcam à 2-3 m (corps entier visible). Seuils de chute = points de départ, **non validés** ; violence : modèle VideoMAE (`--violence`, environ 7 s par fenêtre sur CPU, 2 fenêtres consécutives avant l'alerte), évalué sur RLVS seulement (`docs/EVALUATION_VIOLENCE.md`). Voir `docs/PLANNING.md`.

## Comptes démo (mode démo uniquement)
| Rôle | E-mail | Mot de passe |
|---|---|---|
| Utilisateur | `user@vigilis.demo` | `demo1234` |
| Admin | `admin@vigilis.demo` | `demo1234` |

Boutons de connexion en un clic sur `/login`.

## Scénario de démo en 5 minutes
Voir [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Déploiement (Firebase Hosting, statique)
`web/firebase.json` est fourni (hébergement + rewrite SPA). Aucune configuration Auth/Firestore.
```bash
cd web && npm run build
firebase login && firebase deploy --only hosting   # à faire par vous : déploiement externe
```
HTTPS est utile : la géolocalisation navigateur l'exige.

## Simulé en V1 / prévu en V2
| Élément | V1 | V2 |
|---|---|---|
| Authentification et rôles | Simulés (localStorage, garde de routes) | Firebase Auth + vérification serveur |
| Incidents, journal d'audit | En mémoire + localStorage, synchronisés entre onglets | FastAPI + Firestore (`firebase-admin`) |
| Temps réel | BroadcastChannel / événement `storage` | WebSocket FastAPI |
| Détection | Simulateur + page « Détection » illustrative | Service IA Python (pose + violence + règles de chute) |
| Santé, latence, pannes caméra | Simulées | Mesures réelles du service IA, de l'API et du temps réel |
| Statistiques, fausses alertes | Calculées sur les données simulées | Calculées sur les vraies résolutions des admins |
| Images | Vignettes SVG, visages floutés | Images réelles floutées |
| Notifications | Toast dans l'interface | FCM / e-mail |

Aucun indicateur de performance n'est affiché : « À mesurer ». Le vol est expérimental. 24/7 est une architecture cible.

## Passer en mode FastAPI (V2) : fichiers à remplacer
1. Créer `web/src/services/http/` (implémentations de `IncidentsApi`, `AuthApi`, `SosApi`, voir son README).
2. Modifier `web/src/services/index.ts` pour exposer cette implémentation quand `VITE_DATA_MODE=http`.
3. Retirer le simulateur : `web/src/lib/simulator.ts` et ses usages dans `web/src/components/AdminShell.tsx` (démarrage) et `web/src/pages/CommandCenter.tsx` (boutons de scénario, pause). Remplacer aussi la panne caméra simulée (`AdminHealth`) et la latence simulée (`services/mock`).
4. Retirer le bouton « Réinitialiser la démo » de `web/src/components/AdminShell.tsx`.
5. `web/src/lib/seeds.ts` et `web/src/services/mock/` ne servent plus qu'aux tests.
Les écrans, stores et composants n'importent jamais `mock/` : ils ne changent pas.

## Structure
```
web/src/services   contrats (api.ts, types.ts), mock/, http/ (V2)
web/src/stores     session, données, toasts (Zustand)
web/src/pages      Home, Login, CommandCenter, AdminHealth, AdminStats, AdminAudit, AdminDetection, AdminEvaluation, UserHome, UserAlerts, UserMap, UserPrivacy, UserContacts
web/src/components carte, liste, détail, badges, shells
web/src/lib        seeds, simulateur, moteur de décision, utilitaires
docs/              PLANNING.md, DOCUMENTATION.md, COMPTE_RENDU.md, EVALUATION_CHUTE.md, FIRESTORE_MODEL.md, DESIGN_SYSTEM.md, DEMO_SCRIPT.md
ai/                (venv Python, service IA à venir)
```
