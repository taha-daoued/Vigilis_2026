# Vigilis : compte-rendu d'avancement

PFE solo, soutenance le 05/12/2026. Compte-rendu au **16/11/2026** (J3 sur 20 du planning). Dépôt :
https://github.com/taha-daoued/Vigilis_2026 (23 commits). Documentation technique : `docs/DOCUMENTATION.md`.

## 1. En bref
- Le **chemin SOS de bout en bout fonctionne avec de vrais comptes** : bouton, backend FastAPI, Firestore, dashboard admin
  (alerte reçue sans rechargement). Validé visuellement.
- Le **service IA** lit une webcam ou une vidéo, estime la pose, détecte les chutes par règles et envoie l'alerte au
  backend. La chaîne d'envoi est vérifiée contre le vrai backend et Firestore ; **elle n'a pas encore été testée en direct
  avec la webcam, de la chute à l'alerte affichée chez l'admin**.
- La **détection de chute est mesurée sur un jeu public** : résultat modeste (4 chutes sur 17, 1 fausse alerte sur 20 sur
  le jeu mis de côté). Je la présente comme **expérimentale**.
- Le **modèle de violence est entraîné mais pas branché ni évalué sur le jeu de test** : c'est le principal écart au planning.
- Aucune évaluation sur des vidéos filmées par l'équipe à ce jour.

## 2. Ce qui a été réalisé
| Bloc | Contenu | Preuves |
|---|---|---|
| Frontend | Dashboard admin temps réel (carte, file de priorité, frise 24 h, détail, statistiques, audit CSV), PWA utilisateur avec SOS ; mode démo et mode connecté | 34 tests ; essais visuels |
| Backend FastAPI | `/health`, `/me`, `POST /sos`, `GET`/`PATCH /incidents`, `GET /logs`, `POST /incidents` (service IA, clé API) ; rôles par *custom claim* | 63 tests ; essais réels sur Firestore |
| Firebase | Auth (e-mail et Google activés), Firestore `europe-west8`, règles de sécurité | 14 tests de règles ; 6 échouent si une règle est cassée volontairement |
| IA, pose et chute | YOLO26-pose, suivi des personnes, règles de chute (tronc et cadre), enregistreur de points, client d'envoi | 80 tests ; pose à 144-156 ms/image sur CPU |
| IA, violence | RLVS découpé de façon figée (1 400 / 300 / 300), VideoMAE affiné sur Kaggle | F1 de validation 0,98-0,99 (**pas une performance réelle**) |
| Évaluation | Outils d'évaluation d'un dossier de vidéos, balayage de seuils, jeu GMDCSA24 (160 vidéos, MIT) | `docs/EVALUATION_CHUTE.md` |

## 3. Résultats mesurés
| Mesure | Résultat | Réserve |
|---|---|---|
| Chute, jeu de réglage (sujets 1-3) | 23 chutes sur 62, 0 fausse alerte sur 61 | seuils choisis sur ces vidéos : optimiste |
| **Chute, mesure finale (sujet 4)** | **4 chutes sur 17, 1 fausse alerte sur 20** | petit échantillon ; réglages figés avant la mesure (commit `7ea99df`) ; mesurée **une seule fois** |
| Pose | 144 à 156 ms par image | deux mesures ponctuelles, sans GPU |
| Violence (validation RLVS) | F1 0,98 à 0,99 | jeu facile ; test de 300 vidéos non utilisé |

L'immobilité a été fixée à 2 s pour l'évaluation (vidéos de 5 à 13 s), pas aux 10 s de l'usage réel. Diagnostic des chutes
manquées : une partie ne s'étale jamais à l'écran (axe de la caméra), une partie démarre assise (chaise, lit), le reste a
une descente trop faible. Ce sont les limites de règles simples sur pose 2D.

## 4. Avancement par rapport au planning
| Jour | Prévu | Statut |
|---|---|---|
| J3 | Rôles, règles Firestore testées, vérification des jetons | Fait |
| J4 | Jalon : SOS de bout en bout | **Atteint** |
| J5-J6 | Pose webcam, règles de chute, test sur jeu public | Fait (jeu : GMDCSA24 plutôt que Le2i / UR Fall) |
| J7-J8 | Données violence figées, fine-tuning | Fait (VideoMAE choisi, pas MoViNet) |
| J9 | `GET /incidents`, WebSocket | `GET` fait ; **WebSocket non fait** (actualisation toutes les 2,5 s) |
| J10 | Carte, détail, `PATCH` du statut et audit | Fait |
| J11 | **Jalon : violence comparée à une baseline** | **Non fait** |
| J12 | Intégration violence et chute, moteur de décision | Chute : fait ; **violence : non fait** |
| J13 | **Jalon : chaîne caméra, IA, FastAPI, Firestore, dashboard** | Fait pour la chute côté code ; **à valider en direct** |

Le projet est en avance sur le backend et l'IA de chute, en retard sur la violence.

## 5. Décisions prises
- **FastAPI conservé** entre le service IA et le frontend (il valorise le travail IA) ; Firestore comme base derrière lui.
- **Entraînement sur Kaggle** : la connexion locale était trop lente pour télécharger RLVS (3,85 Go).
- **Doublons de RLVS retirés** : le jeu contenait deux arborescences identiques (4 000 chemins pour 2 000 vidéos), ce qui
  aurait mis la même vidéo en entraînement et en test.
- **Jeu de test verrouillé** (violence) et **sujet 4 de GMDCSA24 mis de côté** (chute) pour éviter des chiffres flatteurs.
- **Règles plutôt qu'un classifieur appris** pour la chute (délai de 20 jours), avec évaluation honnête de leurs limites.
- **Une alerte n'envoie jamais de vidéo ni d'image** ; aucun envoi automatique avec un fichier vidéo.

## 6. Difficultés rencontrées
- Connexion lente au début (environ 100 ko/s) : téléchargements annulés, puis rétablie.
- Plusieurs ajustements d'environnement Windows : port 8080 occupé par un serveur Apache (émulateur sur 8085), dossier
  temporaire trop long pour Java, compte Firebase de la CLI à corriger.
- Un défaut trouvé avant qu'il ne fausse les tests : le temps d'une vidéo était pris sur l'horloge de l'ordinateur.

## 7. Reste à faire (priorité décroissante)
1. **Valider la chaîne en direct** avec la webcam (chute, alerte affichée chez l'admin) et filmer des vidéos maison avec
   consentement (chutes, couché lent, assis vite, marche) pour l'évaluation.
2. **Violence** : mesurer sa vitesse sur ce PC, l'évaluer **une fois** sur le test verrouillé, la comparer à une baseline
   (jalon J11), puis la brancher avec un moteur de décision (seuil, fenêtres consécutives, doublons).
3. WebSocket, notifications FCM, connexion Google dans l'interface, image d'incident (si décidé).
4. Déployer les règles Firestore et le frontend (avec accord), audit sécurité et vie privée, rapport, vidéo de démo de secours.

**Ordre de sacrifice en cas de retard** : vol, second avis VLM, analytics, notifications e-mail. Jamais : SOS, dashboard
temps réel, évaluation sur vidéos maison.

## 8. Risques
- **Détection de chute** : rappel faible. Atténuation : la présenter comme expérimentale, annoncer les chiffres tels quels.
- **Violence** : modèle lourd (VideoMAE-base) dont la vitesse sur CPU n'est pas mesurée ; repli possible vers un modèle plus léger.
- **Domaine** : jeux publics éloignés de la scène de démonstration ; seules les vidéos maison le montreront.
- **Hébergement du backend** : le plan Spark n'héberge pas de Python ; démo prévue entièrement en local (ou tunnel HTTPS).
- **Sécurité** : des clés d'accès (Kaggle, GitHub) ont été collées dans une conversation : **à révoquer** ; mots de passe de
  test faibles dans le projet réel : à changer ou supprimer avant la démonstration.

## 9. Questions pour l'encadrant
1. Quel niveau de rappel est acceptable pour la chute ? Faut-il investir dans un classifieur appris sur les séquences de points ?
2. Hébergement de la démonstration : tout en local, ou frontend en ligne avec tunnel vers le backend ?
3. Image d'incident : une vignette floutée stockée dans Firestore, ou uniquement des données ? (Storage hors plan gratuit.)
4. Protocole de consentement pour filmer des vidéos de test, et durée de conservation.
5. Licences : Ultralytics (AGPL-3.0) et VideoMAE (CC-BY-NC) conviennent-elles pour un rendu académique non commercial ?
6. Attentes sur l'évaluation de la violence : jeu de test public, vidéos maison, ou les deux ?

## 10. Démonstration proposée (5 minutes)
1. Dashboard admin en mode connecté, vue de la carte et de la file.
2. Un utilisateur (fenêtre privée) envoie un **SOS** ; l'alerte apparaît chez l'admin ; prise en charge puis clôture avec résolution.
3. **Webcam** à 2-3 m : chute simulée sur un matelas, alerte « chute » affichée chez l'admin.
4. Présenter honnêtement les résultats mesurés (section 3) et les limites.
