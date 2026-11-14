# Déroulé de démonstration : 5 minutes (V1.1, données simulées)

Prérequis : `npm run build && npm run preview` dans `web/` (ou le site hébergé). Deux fenêtres du **même navigateur** côte à côte (elles partagent les données via le navigateur). Avant de commencer : `/admin` puis **Réinitialiser la démo**. Si une session est déjà ouverte dans l'une des fenêtres, la recharger après avoir changé de compte (la session est partagée entre onglets).

| Min | Action | À dire |
|---|---|---|
| 0:00 | Ouvrir `/` ; la visite guidée (3 bulles) s'ouvre à la première visite, sinon bouton **Visite guidée**. | « Vigilis détecte et alerte, il ne prédit pas. Caméra → IA → décision → alerte → carte, et le SOS en voie directe. » « 24/7 = architecture cible. » |
| 0:45 | Fenêtre A : **Se connecter en tant qu'admin**. | Centre de commande : bande d'état (nouveaux, en cours, temps moyen de prise en charge, caméras, service IA **Simulé**), carte, file de priorité, frise des 24 h. |
| 1:15 | Regarder la file. | Ordre : SOS, puis score, puis ancienneté. Les compteurs d'attente avancent chaque seconde ; ⚠ « Attente dépassée » au-delà de 2 min (seuil réglable). |
| 1:45 | Cliquer **Scénario : Violence**, puis ouvrir l'incident. | Toast + marqueur qui pulse. Détail : image avec **squelette simulé** et visages floutés, score et fenêtres 3/3 avec seuil, mini-carte, incidents proches, historique. |
| 2:30 | **Prendre en charge**, puis **Clôturer…** : choisir **Fausse alerte**. | La résolution est obligatoire ; elle va dans le journal d'activité et dans les statistiques. |
| 3:00 | Fenêtre B : **Se connecter en tant qu'utilisateur**, accepter ou refuser le GPS, maintenir **SOS** 1,5 s. | Le SOS ne passe pas par l'IA. Si le GPS est refusé, il part « sans position ». |
| 3:30 | Regarder la fenêtre A. | Le SOS est **en tête de la file** en moins d'une seconde. **Prendre en charge** : la frise de l'utilisateur passe à « Prise en charge » en direct ; **Clôturer** : message clair à l'utilisateur. |
| 4:00 | Fenêtre A : **Santé** → **Simuler une panne caméra**. | Caméras, état des services (Simulé), latence du dernier incident vs **objectif** 3 s (« objectif, pas une mesure garantie »). La panne se voit dans la bande d'état, sur la carte et dans le journal. **Rétablir**. |
| 4:30 | **Statistiques** puis **Mode supervision** (Échap pour quitter). | Carte de chaleur heure × jour, part de fausses alertes (« indicateur opérationnel, pas une métrique du modèle »), aucune prévision. Supervision : plein écran, texte agrandi, son muet par défaut (SOS et violence seulement). |

Compléments possibles : page **Détection** (seuil + fenêtres consécutives), **Performance et conformité** (« À mesurer »), export CSV du journal, sélecteur **Vue démo** pour passer d'admin à utilisateur sans déconnexion, pages utilisateur **Alertes / Carte / Vie privée / Contacts** (« Prévu V2 »).

Hors ligne : installer la PWA puis couper le réseau ; l'app utilisateur reste utilisable, seules les tuiles de carte manquent (fond de grille de repli).
