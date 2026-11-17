# Vigilis : documentation technique

Plateforme de détection et de signalement des situations à risque (chute, violence, SOS ; vol expérimental).
**Le système détecte tôt et alerte vite ; il ne prédit pas.** État au 16/11/2026. Les limites et les chiffres
réels sont à la fin de ce document : lisez-les avant de présenter le projet.

## 1. Vue d'ensemble

```
                 ┌────────────┐   ID token Firebase     ┌──────────────────┐
  Utilisateur ──▶│  PWA React │───────────────────────▶│                  │
  (bouton SOS)   └────────────┘   POST /sos             │   Backend        │   firebase-admin   ┌───────────┐
                                                        │   FastAPI        │──────────────────▶│ Firestore │
  Admin ────────▶┌────────────┐   GET/PATCH /incidents  │  (port 8000)     │                   │ (Spark)   │
  (dashboard)    │ Dashboard  │◀───────────────────────│                  │                   └───────────┘
                 │  React     │   actualisation 2,5 s   └──────────────────┘
                 └────────────┘                                  ▲
                                                                 │ POST /incidents (clé API)
  Webcam / vidéo ──▶ ┌──────────────────────────────────┐        │
                     │ Service IA (Python, local)        │────────┘
                     │ YOLO26-pose → règles de chute     │
                     └──────────────────────────────────┘
```

| Composant | Dossier | Rôle |
|---|---|---|
| Frontend | `web/` | PWA utilisateur (SOS) et dashboard admin (carte, file de priorité, audit) |
| Backend | `backend/` | Vérifie l'identité, applique les rôles, écrit et lit dans Firestore |
| Service IA | `ai/` | Lit une caméra ou une vidéo, détecte les chutes, envoie les alertes |
| Base de données | Firebase `vigilis-2026` | Auth (e-mail/mot de passe, Google), Firestore `europe-west8`, plan Spark |

Hors périmètre : PostgreSQL, Redis, Nginx, Docker, vol (module facultatif), second avis VLM.

## 2. Frontend (`web/`)
React 19, Vite 8, TypeScript strict, Tailwind v4, Leaflet, Zustand, PWA (hors ligne), tests Vitest.

- **Deux modes**, choisis par `VITE_DATA_MODE` :
  - `mock` (par défaut, `npm run dev`) : démonstration 100 % dans le navigateur, données simulées, aucun réseau ;
  - `http` (`npm run dev:live`) : FastAPI et Firebase réels.
- **Couche de services** : les écrans ne dépendent que des interfaces de `src/services/api.ts`. L'implémentation est
  choisie dans `src/services/index.ts` (`mock/` ou `http/`). Passer du mode démo au mode réel ne modifie aucun écran.
- **Admin** : centre de commande (carte, file de priorité SOS puis score puis ancienneté, compteur d'attente, frise des
  24 h), détail d'incident, clôture avec résolution obligatoire (confirmé / fausse alerte), santé, statistiques,
  journal d'audit avec export CSV, mode supervision.
- **Utilisateur** : bouton SOS (appui long 1,5 s) avec position GPS consentie et révocable, suivi en direct,
  historique, confidentialité, contacts.
- **Mode connecté** : bandeau vert « backend FastAPI et Firestore réels », contrôles de démonstration masqués.
  Actualisation toutes les 2,5 s (le WebSocket n'est pas encore fait). Caméras et santé détaillée vides tant
  que le service IA n'est pas branché à une caméra configurée.
- Voir aussi `docs/DESIGN_SYSTEM.md` (couleurs, formes, accessibilité) et `docs/DEMO_SCRIPT.md` (démo de 5 minutes).

## 3. Backend (`backend/`)
FastAPI, firebase-admin, pydantic. Configuration par `backend/.env` (modèle : `.env.example`), jamais de secret dans le code.

### Routes
| Méthode et chemin | Qui | Rôle |
|---|---|---|
| `GET /health` | public | état du serveur |
| `GET /me` | utilisateur connecté | identité et rôle vérifiés |
| `POST /sos` | utilisateur connecté | crée une alerte SOS (position facultative) |
| `GET /incidents` | connecté | admin : tous ; utilisateur : les siens |
| `PATCH /incidents/{id}` | admin | statut `nouveau` / `en_cours` / `cloture` ; résolution obligatoire à la clôture ; journal d'audit |
| `GET /logs` | admin | journal d'audit |
| `POST /incidents` | **service IA seulement** (`X-API-Key`) | crée une alerte issue d'une caméra |

### Authentification et rôles
- Le navigateur envoie `Authorization: Bearer <ID token Firebase>` ; le serveur vérifie la signature.
- Le rôle (`user` ou `admin`) est le *custom claim* `role` du jeton, posé côté serveur :
  `python -m scripts.set_role <email> <user|admin>`. Toute autre valeur vaut `user`.
- Le service IA s'authentifie par clé API (comparée en temps constant). Si la clé n'est pas configurée, la route est
  désactivée (503). Un jeton Firebase, même admin, ne suffit pas à créer une détection.

### Règles de validation (corps strict : tout champ inconnu est refusé)
- `POST /sos` : position `{lat ∈ [-90, 90], lng ∈ [-180, 180]}` ou absente. Le serveur décide de l'identité, du statut
  et des heures. Double appui sous 60 s : même alerte renvoyée.
- `POST /incidents` : type `violence` | `chute` | `vol`, score 0-1, position de la caméra, `cameraId`, description
  ≤ 300 caractères, fenêtres confirmées. Heure d'événement acceptée si plausible. Doublon (même caméra et même type
  sous 30 s) : même alerte renvoyée. Le vol reçoit `experimental: true`.
- Détail des contrats : `docs/FIRESTORE_MODEL.md`.

## 4. Données et sécurité Firestore
Collections `users`, `alerts`, `alert_logs` (champs alignés sur les types du frontend, `docs/FIRESTORE_MODEL.md`).

- **Aucune écriture depuis le navigateur** : toute écriture passe par FastAPI (firebase-admin).
- **Règles** (`web/firestore.rules`) : un utilisateur lit son profil et ses alertes ; l'admin lit tout ; le journal est
  réservé à l'admin ; tout le reste est interdit. **14 tests** sur l'émulateur (`npm run test:rules`) ; en cassant
  volontairement une règle, 6 tests sur 14 échouent. **Les règles ne sont pas déployées** sur le projet réel : la base
  garde les règles « tout refusé » par défaut, ce qui n'empêche pas le backend de travailler.
- Les écritures atomiques (alerte et journal ensemble) évitent les états incohérents.

## 5. Service IA (`ai/`)
Python, OpenCV, Ultralytics (YOLO26-pose), PyTorch. Modèle : `ai/models/yolo26n-pose.pt` (non versionné).

- `pose.py` : 17 points du corps et suivi des personnes par image ; `clock.py` : le temps d'une vidéo vient de la
  vidéo, celui d'une webcam de l'horloge réelle.
- `fall.py` : détection de chute par règles temporelles, deux signaux indépendants :
  1. **tronc** : angle épaules-hanches et descente des hanches ;
  2. **cadre** : forme du cadre de la personne (largeur / hauteur) et descente.
  Une chute est déclarée après une descente rapide de debout à couché, puis une immobilité (`confirm_s`, 10 s par
  défaut). Le système ne juge que si le corps est assez visible (épaules et hanches sûres, loin du bord de l'image).
  Ne déclenchent rien : se coucher lentement, s'asseoir vite, se pencher. Réglages figés : `fall.TUNED` (`--tuned`).
- `client.py` : envoi des alertes à `POST /incidents` **en arrière-plan** (la détection n'attend jamais le réseau),
  reprises sur coupure ou erreur serveur, pas de nouvel essai sur 401/403/422. La clé API et la position ne sont
  jamais écrites dans les journaux (testé). `config.py` lit `ai/.env`.
- Outils : `view.py` (affichage et envoi), `record.py` (enregistre les **points**, jamais les images), `replay.py`,
  `evaluate.py` (évaluation d'un dossier de vidéos), `tune.py` (balayage de seuils), `prepare_gmdcsa24.py`.
- **Violence** (`ai/violence/`) : jeu RLVS découpé de façon figée (graine 2026 : 1 400 / 300 / 300, doublons du dataset
  retirés), VideoMAE-base (Kinetics-400) affiné sur Kaggle (script `train_videomae.py`, journaux dans le notebook). Le
  modèle est entraîné et évalué (`infer.py`, `benchmark_speed.py`, `eval_violence_testset.py`, baseline `baseline.py`, voir
  `docs/EVALUATION_VIOLENCE.md`) et **branché sur la caméra** (`vigilis_ai/violence.py`, option `--violence` de `view.py`) :
  les 16 images des 5 dernières secondes sont données au modèle dans un fil à part (environ 7 s par fenêtre sur CPU) ;
  l'alerte n'est envoyée qu'après **2 fenêtres consécutives** au-dessus du seuil 0,5, puis 60 s d'attente. Vérifié sur un
  montage de clips de validation RLVS (alerte sur le montage violent, aucune sur le normal) ; **pas encore testé en
  direct sur webcam**. Lancé avec la pose, le traitement d'une image passe d'environ 150 ms à 420-530 ms (CPU partagé).

## 6. Installation et lancement
Prérequis : Node 24, Python 3.13, Java (tests de règles), `firebase-tools`. Secrets hors du dépôt :
`backend/.env`, `ai/.env`, fichier de compte de service (hors du dépôt, chemin dans `backend/.env`).

```bash
# 1. Backend (http://localhost:8000)
cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
# 2. Frontend démo (mock)            3. Frontend connecté (vrais comptes)
cd web && npm install && npm run dev      cd web && npm run dev:live
# 4. Service IA : webcam + détection de chute + envoi (webcam à 2-3 m, corps entier visible)
cd ai && venv\Scripts\python.exe -m vigilis_ai.view --source 0 --fall --send --confirm-s 5
```
Ne pas utiliser `--send` avec un fichier vidéo : ses chutes partiraient comme de vraies alertes.

## 7. Tests (au 16/11/2026)
| Zone | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && venv\Scripts\python.exe -m pytest` | 63 réussis |
| Service IA | `cd ai && venv\Scripts\python.exe -m pytest` | 80 réussis |
| Frontend | `cd web && npm test` | 34 réussis |
| Règles Firestore | `cd web && npm run test:rules` | 14 réussis (émulateur) |

Tests significatifs : authentification (jeton absent, invalide, rôle), validation stricte des corps, doublons,
règles de chute sur séquences simulées (chute, relevé, couché lent, assis vite, penché, corps tronqué), client d'envoi
avec faux serveur. Essais **réels** sur Firestore (créer, relire, supprimer) pour le SOS et les détections.
Sous Windows, l'émulateur Firestore demande un dossier temporaire court pour Java (voir `docs/FIRESTORE_MODEL.md`).

## 8. Résultats mesurés
- **Chute** (GMDCSA24, voir `docs/EVALUATION_CHUTE.md`) : jeu de réglage 23 chutes sur 62, 0 fausse alerte sur 61 ;
  **mesure finale sur le sujet 4, réglages figés : 4 chutes sur 17, 1 fausse alerte sur 20**. Immobilité de 2 s pour
  cette évaluation (vidéos courtes), pas les 10 s du direct.
- **Pose** : 144 à 156 ms par image sur le processeur de ce PC (vidéo de surveillance, puis webcam), mesures ponctuelles.
- **Violence** (`docs/EVALUATION_VIOLENCE.md`) : test verrouillé de 300 vidéos RLVS, mesuré une seule fois, seuil 0,5 :
  **VideoMAE 149 violences sur 150, 4 fausses alertes sur 150, F1 0,984**, contre **0,748** pour la baseline de mouvement
  (flux optique + gradient boosting). Jeu facile : ne prédit pas la performance sur une scène réelle. Vitesse
  d'inférence : **7,1 s par clip de 16 images sur CPU**.
- **SOS et dashboard** : validés visuellement en mode connecté (alerte reçue côté admin sans rechargement), sans mesure
  chiffrée de latence.

## 9. Limites connues
- Rappel faible de la détection de chute sur ce jeu (voir plus haut) ; une chute dans l'axe de la caméra ou sans
  immobilité n'est pas vue ; une personne qui fait des pompes de côté peut déclencher une fausse alerte.
- Le score d'une alerte est un indicateur des règles, pas une probabilité.
- Violence : non évaluée sur des vidéos réalistes ou maison ; pas de temps réel sur CPU (7,1 s par clip) ; branchée mais non testée en
  direct sur webcam ; la pose et la violence ensemble ralentissent le traitement (CPU partagé).
- Pas de WebSocket (actualisation toutes les 2,5 s), pas de notifications FCM/e-mail, connexion Google non branchée
  dans l'interface, pas d'image d'incident (stockage non décidé), préférences de confidentialité gardées dans le
  navigateur, règles Firestore non déployées.
- « 24/7 » est une architecture cible, pas une garantie démontrée.
- Aucune évaluation sur vidéos filmées par l'équipe à ce jour.

## 10. Confidentialité et licences
- Pas de secret, de GPS ni d'image dans les journaux ou les commits ; `.env`, clés, poids de modèles, jeux de données
  et enregistrements sont ignorés par Git. L'enregistreur ne conserve que les coordonnées des points du corps.
- Aucune vidéo personnelle n'est envoyée à un fournisseur externe.
- Licences : Ultralytics (YOLO) **AGPL-3.0** ; VideoMAE (`MCG-NJU/videomae-base-finetuned-kinetics`) **CC-BY-NC-4.0**
  (usage non commercial) ; RWF-2000 non commercial sans accord ; GMDCSA24 **MIT** (à citer : Alam et al., 2024,
  *Data in Brief*) ; Le2i CC-BY-NC-SA 3.0 (non utilisé).

## 11. Structure du dépôt
```
web/       frontend (src/pages, src/components, src/services/{mock,http}, src/stores) + règles Firestore et leurs tests
backend/   app/{main,auth,sos,incidents,detections,models,repository,roles,firebase_app,config}.py, scripts/, tests/
ai/        vigilis_ai/ (pose, fall, client, clock, evaluate, tune...), violence/ (RLVS, VideoMAE), tests/
docs/      PLANNING, DOCUMENTATION, COMPTE_RENDU, EVALUATION_CHUTE, FIRESTORE_MODEL, DESIGN_SYSTEM, DEMO_SCRIPT
```
