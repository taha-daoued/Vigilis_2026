# Planning Vigilis — 20 jours (J1 = 14/11/2026, soutenance 05/12/2026)

Source : `recap_pfe_detection_risques.pdf` (11/11/2026), adapté à la stack retenue : **backend FastAPI conservé** comme liaison entre le service IA et le frontend ; Firebase Auth + Firestore pour l'identité et les données ; sans PostgreSQL/Redis/Nginx/Docker.

## Écarts entre le PDF et la stack actuelle
| PDF | Stack retenue | Conséquence |
|---|---|---|
| Backend FastAPI + WebSocket | **Conservé** : API incidents/SOS + WebSocket vers le dashboard | Cœur de la valorisation du travail IA |
| PostgreSQL | Firestore (`users`, `alerts`, `alert_logs`), écrit par FastAPI via `firebase-admin` | Règles de sécurité à tester |
| JWT + rôles | Firebase Auth : le frontend envoie son ID token, FastAPI le vérifie ; custom claim `admin` | Rôle posé côté serveur (script admin) |
| Service IA → `POST /incidents` | **Conservé** : service Python → FastAPI (clé API) → Firestore + WebSocket | Clé API et clé de compte de service hors Git |
| Stockage images | Storage écarté (plan Spark) | À décider J1 : miniature réduite dans l'alerte, ou pas d'image. À vérifier avant de s'engager |
| Docker, Nginx, Redis, Locust | Hors périmètre | 24/7 présenté comme architecture cible, pas comme garantie |
| Modèle « YOLO26-pose » | À vérifier en J5 que la version installée de `ultralytics` le fournit | Repli : un modèle pose plus ancien |

## Jalons (points de contrôle)
- **J4** : SOS de bout en bout (PWA → FastAPI → Firestore).
- **J11** : modèle violence choisi après comparaison à la baseline.
- **J13** : chaîne caméra → IA → FastAPI → Firestore/WebSocket → dashboard fonctionnelle en local.
- **J16** : mesures réelles faites (précision, rappel, F1, faux positifs/h).
- **J20** : code gelé, démo de secours enregistrée.

## Planning détaillé
| Jour | Date | Travail | Livrable vérifiable |
|---|---|---|---|
| J1 | 14/11 | Vérifier `projectId` dans la console ; figer le modèle Firestore (`users`, `alerts`, `alert_logs`) ; lancer le téléchargement RWF-2000 (copie Hugging Face) et RLVS (Kaggle) | `docs/FIRESTORE_MODEL.md`, datasets en cours |
| J2 | 15/11 | Maquettes + diagramme (séquence SOS, séquence alerte IA) ; routage React ; page login e-mail + Google ; squelette FastAPI (`/health`, CORS, config par `.env`) | Login fonctionnel, `/health` répond |
| J3 | 16/11 | Rôles `user`/`admin` (custom claim), règles Firestore, tests des règles ; FastAPI : vérification de l'ID token Firebase, dépendance `require_admin` | Tests de règles et d'auth qui passent |
| J4 | 17/11 | PWA : bouton SOS + géolocalisation avec consentement → `POST /sos` → FastAPI écrit `alerts` | Alerte SOS visible dans Firestore |
| J5 | 18/11 | `ai/` : capture webcam + pose + suivi ; vérifier le modèle pose disponible | Squelettes affichés en direct |
| J6 | 19/11 | Règles de chute (vertical → horizontal, chute rapide du centre, immobile > 10 s) ; test sur Le2i / UR Fall | Résultats chute sur jeu de test |
| J7 | 20/11 | Préparation données violence (16 images/clip, redimensionnement, train/val/test **verrouillé**) ; notebook Kaggle | Jeu de test figé, notebook prêt |
| J8 | 21/11 | Fine-tuning MoViNet (ou VideoMAE) sur GPU Kaggle ; en parallèle : FCM/e-mail côté service | Premier entraînement lancé |
| J9 | 22/11 | FastAPI : `GET /incidents`, WebSocket de diffusion aux admins ; dashboard : liste temps réel | Liste live via WebSocket |
| J10 | 23/11 | Carte Leaflet + marqueurs, détail d'alerte, `PATCH` de statut (nouveau / en cours / clôturé) avec écriture `alert_logs` | Carte + audit |
| J11 | 24/11 | Évaluation violence vs baseline MoViNet4Violence sur le même jeu de test ; export ONNX/TFLite | Tableau comparatif réel |
| J12 | 25/11 | Intégration violence (tampon de 16 images) + chute ; moteur de décision (seuil, N fenêtres consécutives, déduplication, temporisation) | Incidents locaux déclenchés |
| J13 | 26/11 | Service IA → `POST /incidents` (clé API) → FastAPI → Firestore + WebSocket ; test bout en bout | Alerte IA visible sur la carte |
| J14 | 27/11 | Notifications FCM/e-mail envoyées par FastAPI, destinataires de test uniquement ; PWA installable | Notification reçue |
| J15 | 28/11 | Frontend sur Firebase Hosting (`firebase init` puis déploiement, **avec ton autorisation**) ; FastAPI lancé en local pour la démo (voir points à trancher) ; tournage de 20–30 vidéos (consentement des personnes filmées) | Frontend en ligne, vidéos de test |
| J16 | 29/11 | Évaluation sur vidéos maison ; faux positifs par heure sur vidéos normales ; réglage des seuils | Métriques réelles |
| J17 | 30/11 | Latence de bout en bout (objectif < 3 s, à mesurer, pas à promettre) ; correctifs. Module vol **seulement si en avance** | Mesure de latence |
| J18 | 01/12 | Audit sécurité et vie privée : règles Firestore, secrets, GPS/images dans les logs, durée de conservation, consentement | Check-list signée |
| J19 | 02/12 | Rapport (réalisation, résultats réels, limites) ; vidéo de démo de secours | Rapport + vidéo |
| J20 | 03/12 | Répétition de soutenance ; gel du code (tag git) | Démo répétée |
| — | 04–05/12 | Tampon, puis soutenance | |

## Ordre de sacrifice si du retard
1. Module vol. 2. Second avis VLM. 3. Analytics. 4. VideoMAE (garder MoViNet). 5. Notifications e-mail (garder FCM ou l'inverse). **Jamais** : SOS, dashboard temps réel, évaluation sur vidéos maison.

## Points à trancher
- Hébergement de FastAPI : le plan Spark n'héberge pas de backend Python. Démo plus sûre : tout en local (frontend + FastAPI + IA sur le même PC). Un frontend en HTTPS ne peut pas appeler un backend en HTTP ; il faudrait un tunnel HTTPS ou un hébergeur gratuit, à décider avant J15.
- Image de l'incident : miniature dans Firestore ou aucune.
- Compte Firebase/Google propriétaire du projet : unique et le même pour la CLI et la console.
- Violence : MoViNet (TensorFlow) ou VideoMAE (PyTorch). Recommandation : MoViNet, plus léger sur CPU. Le venv `ai/` ne contient pas encore TensorFlow.
- Licences : Ultralytics AGPL-3.0 (usage éducatif OK) ; RWF-2000 sans usage commercial ; Le2i en CC-BY-NC-SA.

## Rappels de risque
- Le système détecte tôt, il ne prédit pas.
- Aucune métrique ne doit être annoncée avant mesure sur le jeu de test verrouillé et les vidéos maison.
- Aucune vidéo personnelle envoyée à un fournisseur externe sans consentement explicite.

## Note : V1 démo statique livrée
La V1 démo statique (web/, mock + PWA, sans backend ni IA) est livrée. Le reste du planning est inchangé : FastAPI, Firebase et service IA suivent en V2. Voir README.md et docs/DEMO_SCRIPT.md.
