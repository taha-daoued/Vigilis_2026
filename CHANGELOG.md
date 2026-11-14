# Changelog

## V1.1 : vues globales admin et utilisateur
Toujours 100 % mock : aucun backend, aucun Firebase, aucun appel réseau hors tuiles OSM.

### Admin
- **Centre de commande** (`/admin`) : `StatusBar`, `LiveMap`, `PriorityQueue`, `DayTimeline`.
- **File de priorité** : SOS, puis score, puis ancienneté ; compteur d'attente à la seconde (seuil réglable, ⚠ + texte) ; actions rapides.
- **Clôture avec résolution** obligatoire (Confirmé / Fausse alerte) via `<dialog>` natif, tracée dans l'audit.
- **Détail enrichi** : image + squelette simulé, score + fenêtres consécutives, mini-carte, incidents proches (± 10 min, ≤ 300 m), historique.
- **Santé** (`/admin/health`) : caméras, services (Simulé), latence vs objectif 3 s, panne caméra simulée / rétablir.
- **Statistiques** (`/admin/stats`) : carte de chaleur, répartition par type et caméra, délai de prise en charge, part de fausses alertes (calculée).
- **Mode supervision** : plein écran, texte agrandi, son (SOS et violence uniquement, muet par défaut).
- **Journal d'activité** : filtres admin / action / type / période, recherche, tri, export CSV.

### Utilisateur (PWA)
- Accueil : gros bouton SOS (appui long 1,5 s) + ligne d'état ; frise verticale de suivi en direct.
- Historique (« Mes alertes »), carte simple (caméras activables), centre de confidentialité (GPS révocable : le SOS part « sans position »), contacts de confiance (Prévu V2).

### Transversal
- Sélecteur de rôle sans déconnexion, visite guidée en 3 étapes, réinitialisation étendue (pannes, résolutions, préférences).
- Palette des types validée avec le validateur du skill `dataviz` : violence `#e11d48`, chute `#bf8a00` (les anciennes valeurs échouaient au plancher de vision normale).

### Données et services
- `Incident` : `receivedAt`, `takenAt`, `closedAt`, `resolution` ; `position` peut être `null` (SOS sans GPS).
- `Camera` : `lastFrameAt`, `incidentsToday`, `simulatedOutage` ; `SystemHealth`, `PrivacyPrefs`, `AlertLog.kind`.
- Nouvelles méthodes derrière `services/api.ts` (`getHealth`, `simulateCameraOutage`, `restoreCameras`, `PrefsApi`) ; clé de stockage `vigilis.demo.v2`.
- 34 tests (priorité, proximité, statistiques, CSV, services mock).

## V1 : démo statique
Voir le dépôt : dashboard admin, PWA utilisateur SOS, simulateur, couche services mock.
