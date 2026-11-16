# Évaluation de la détection de chute (règles sur la pose)

> Résultats réels, mesurés sur un jeu public. Ils ne sont **pas** une performance garantie du système :
> voir les limites en fin de document.

## Méthode
- **Système évalué** : pose YOLO26-pose (`yolo26n-pose.pt`) puis règles temporelles (`ai/vigilis_ai/fall.py`) :
  descente rapide d'un tronc / cadre de personne qui passe de debout à couché, puis immobilité. Deux signaux
  indépendants (tronc, cadre englobant), une seule alerte par chute.
- **Jeu de données** : GMDCSA24 (Alam et al., 2024, licence MIT), 160 vidéos, 4 sujets : 79 chutes et 81 activités
  de la vie quotidienne (s'asseoir, s'allonger sur le lit, marcher, lire, exercices...). Vidéos courtes (5 à 13 s).
- **Découpage** : sujets 1 à 3 = jeu de **réglage** (123 vidéos : 62 chutes, 61 normales) ; sujet 4 = jeu de **mesure
  finale** (37 vidéos : 17 chutes, 20 normales), **jamais utilisé avant la fin des réglages**.
- **Immobilité exigée : 2 s** (au lieu de 10 s en usage réel), car les vidéos ne montrent la personne au sol que
  2 à 4 s après la chute. Ce n'est donc pas le réglage de la démonstration en direct.
- **Procédure** : réglages cherchés uniquement sur les sujets 1-3 (outil `tune.py`), puis figés et commités
  (commit `7ea99df`), puis mesure unique sur le sujet 4 (`evaluate.py --tuned --confirm-s 2`). Aucun changement
  n'a été fait après avoir vu le résultat du sujet 4.

## Résultats
| Jeu | Réglage | Chutes détectées | Fausses alertes |
|---|---|---|---|
| Réglage (sujets 1-3) | valeurs par défaut | 16 sur 62 | 0 sur 61 |
| Réglage (sujets 1-3) | tronc réglé | 21 sur 62 | 0 sur 61 |
| Réglage (sujets 1-3) | tronc + cadre, réglages figés | 23 sur 62 | 0 sur 61 |
| **Mesure finale (sujet 4)** | réglages figés | **4 sur 17** | **1 sur 20** |

- La baisse entre le réglage (23/62) et la mesure finale (4/17) est attendue : les seuils ont été choisis sur les
  sujets 1-3. Les comptes sont petits : **ne pas les présenter comme des pourcentages fiables**.
- Les 4 chutes détectées sont des chutes marchées ou depuis le lit. L'unique fausse alerte est un exercice de
  pompes (`S4_adl_06`, vue de côté) : un corps horizontal qui descend vite.
- Sur les 13 chutes manquées du sujet 4, une seule a le corps visible dans moins de la moitié des mesures : le
  problème n'est pas surtout la visibilité.

## Pourquoi tant de chutes manquées (diagnostic sur le jeu de réglage)
Sur 39 chutes manquées : environ 16 n'ont jamais un cadre de personne assez large (la personne ne s'étale pas à
l'écran, par exemple chute dans l'axe de la caméra) ; 12 démarrent assis (chaise, lit), donc sans phase « debout »
juste avant ; environ 10 ont une descente trop faible ou sont bloquées par un mouvement au sol. Ce ne sont pas des
seuils à régler : les règles simples sur pose 2D atteignent un plafond sur ce jeu de données.

## Limites
- Vidéos courtes, personnes filmées dans un logement, 4 sujets seulement : ne représente ni une caméra de
  surveillance ni votre scène de démonstration.
- Le résultat pour l'usage réel (immobilité de 10 s) n'est pas mesuré ici.
- Aucune mesure sur des vidéos maison à ce jour (voir `docs/PLANNING.md` : évaluation sur vidéos maison prévue).
- Les chutes ne se mesurent pas toutes de la même façon : une chute sans immobilité n'est pas détectée par conception.
- Le score d'une alerte est un indicateur des règles, pas une probabilité.

## Pistes (non faites)
Classifieur appris sur les séquences de points (LSTM, mentionné comme optionnel dans le récapitulatif), plus de
données d'entraînement variées, ou prise en compte de la vue de côté pour les exercices au sol. À défaut, présenter
la détection comme **expérimentale** et annoncer ces chiffres tels quels.

## Reproduire
```bash
cd ai
venv\Scripts\python.exe -m vigilis_ai.prepare_gmdcsa24 data\gmdcsa24 data\gmdcsa24_eval
venv\Scripts\python.exe -m vigilis_ai.evaluate data\gmdcsa24_eval\dev --tuned --confirm-s 2
venv\Scripts\python.exe -m vigilis_ai.evaluate data\gmdcsa24_eval\final --tuned --confirm-s 2
```
Citer : E. Alam, A. Sufian, P. Dutta, M. Leo, I. A. Hameed, « GMDCSA24: A Dataset for Human Fall Detection in
Videos », Data in Brief, 2024.
