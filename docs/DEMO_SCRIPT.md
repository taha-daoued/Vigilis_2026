# Déroulé de démonstration : 5 minutes (V1, données simulées)

Prérequis : `npm run build && npm run preview` dans `web/` (ou le site hébergé). Deux fenêtres de navigateur côte à côte, **même navigateur** (les onglets partagent les données via le navigateur).

| Min | Action | À dire |
|---|---|---|
| 0:00 | Ouvrir `/`. | « Vigilis détecte et alerte, il ne prédit pas. Une caméra analysée par l'IA et un bouton SOS alimentent une même carte. » Montrer le schéma, « 24/7 = architecture cible ». |
| 0:45 | Fenêtre A : `/login` → **Se connecter en tant qu'admin**. | Carte, caméras, 14 incidents de départ, compteurs. Bandeau « Version démo : données simulées ». |
| 1:30 | Attendre ou cliquer **Scénario : Violence**. | Toast + marqueur qui pulse : un incident arrive seul toutes les 20-40 s. |
| 2:00 | Ouvrir l'incident → **Prendre en charge** → **Clôturer**. | Détail, score, fenêtres confirmées, historique. Chaque action est écrite dans le journal d'audit. |
| 2:45 | Fenêtre B : `/login` → **Se connecter en tant qu'utilisateur** → maintenir **SOS** 1,5 s. | Consentement GPS ; position réelle ou simulée, expliquée. Le SOS ne passe pas par l'IA. |
| 3:15 | Regarder la fenêtre A. | Le SOS apparaît en moins d'une seconde. Le passer en cours puis clôturé : la fenêtre B affiche « Prise en charge » puis « Clôturée ». |
| 3:45 | Fenêtre B : ouvrir `/admin`. | Refusé : les rôles sont appliqués. |
| 4:00 | Fenêtre A : **Détection**. | Score, seuil, « fenêtres consécutives 3/3 », alerte. Une pointe isolée ne déclenche rien. Mention : illustration, l'analyse réelle viendra du service IA. |
| 4:30 | **Performance et conformité** puis **Réinitialiser la démo**. | Aucun chiffre inventé : « À mesurer », objectif de latence < 3 s. Vol = expérimental. Prochaines étapes : service IA + backend FastAPI (V2). |

Hors ligne : installer la PWA (icône d'installation du navigateur) puis couper le réseau ; les pages restent utilisables, seules les tuiles de carte manquent (fond de grille de repli).
