# Vigilis — PFE solo

## Contexte
PFE solo, MVP démontrable, deadline 05/12/2026. Le système détecte tôt, il ne prédit pas.

## Stack
- web/ : React + Vite + Leaflet
- Firebase projet `vigilis-2026`, plan Spark : Auth (e-mail/mot de passe + Google), Firestore, FCM, Hosting
- ai/ : Python local, OpenCV + YOLO-pose + MoViNet4Violence ; envoie les incidents au backend FastAPI (clé API)
- backend/ : FastAPI, liaison entre le service IA et le frontend ; vérifie les ID tokens Firebase, écrit dans Firestore via firebase-admin, diffuse en WebSocket aux admins

## Périmètre
- Dedans : auth et rôles user/admin, bouton SOS + géolocalisation, dashboard admin temps réel, détection chute et violence, notifications
- Hors périmètre : PostgreSQL, Redis, Nginx, Docker, vol, VLM, fine-tuning bonus

## Règles
- Une tâche à la fois, plan avant code, commits fréquents
- Jamais de secrets dans le code : tout passe par .env
- Tester les règles Firestore
- Code commenté simplement (à expliquer au jury)
- Le système détecte tôt, il ne prédit pas

## Modèle Firestore
users, alerts, alert_logs
