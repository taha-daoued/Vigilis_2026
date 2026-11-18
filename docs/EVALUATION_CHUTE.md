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
| Réglage (sujets 1-3), après suivi de secours (18/11) | mêmes réglages | 34 sur 62 | 1 sur 61 |
| Sujet 4, après suivi de secours (18/11) | mêmes réglages, **seconde mesure** | 6 sur 17 | 0 sur 20 |

- **Mise à jour du 18/11/2026 : suivi de secours des personnes.** Un essai en direct (webcam, chambre, personne qui
  s'allonge sur un lit) n'a déclenché aucune alerte : le suivi du détecteur de pose attribue souvent « id None » ou un
  nouvel identifiant à une personne qui passe à l'horizontale, et sans identifiant stable les règles n'ont plus d'histoire
  « debout » à comparer. Correction : reconnaître la personne par la position de son cadre (à moins d'une taille de
  personne de sa dernière position, vue il y a moins de 3 s). Les seuils n'ont **pas** changé. Résultat avec les mêmes
  réglages : jeu de réglage **34 chutes sur 62** (avant 23) avec **1 fausse alerte sur 61** (avant 0, `S2_adl_22`) ;
  sujet 4 **6 sur 17, 0 fausse alerte sur 20** (avant 4 sur 17, 1 sur 20). **Réserve : le sujet 4 avait déjà été mesuré une
  fois ; cette seconde mesure n'est plus une mesure vierge** (la correction a été décidée à partir de l'essai en direct,
  pas des résultats du sujet 4, mais ce chiffre reste à prendre avec prudence). Les mesures non biaisées viendront des
  vidéos maison.
- La baisse entre le réglage (23/62) et la mesure finale (4/17) est attendue : les seuils ont été choisis sur les
  sujets 1-3. Les comptes sont petits : **ne pas les présenter comme des pourcentages fiables**.
- Les 4 chutes détectées sont des chutes marchées ou depuis le lit. L'unique fausse alerte est un exercice de
  pompes (`S4_adl_06`, vue de côté) : un corps horizontal qui descend vite.
- Sur les 13 chutes manquées du sujet 4, une seule a le corps visible dans moins de la moitié des mesures : le
  problème n'est pas surtout la visibilité.

## Essai en direct sur webcam (18/11/2026, après le suivi de secours)
Une personne, chambre, caméra fixe, corps entier visible, immobilité exigée 5 s (`--confirm-s 5`), réglages par défaut du
direct. Le testeur a joué **5 chutes** sur le lit et **3 gestes normaux** (non précisés). Résultat vérifié dans Firestore :
**3 alertes reçues** (scores 0,91, 0,85, 0,86 ; 5 s d'immobilité confirmées ; reçues environ 7 s après la chute).

| Essais | Alertes | Lecture |
|---|---|---|
| 5 chutes jouées | 3 alertes | **3 chutes détectées sur 5** (60 %), en attribuant les 3 alertes à des chutes |
| 3 gestes normaux | 0 alerte attribuée | **0 fausse alerte sur 3**, selon les notes du testeur |

**Seconde session le même jour (enregistrement d'écran de 122 s, vérifié image par image) : 3 chutes jouées sur le lit,
3 alertes** (bandeau « CHUTE DETECTEE » à 15 s, 67 s et 109 s, correspondant aux 3 alertes de Firestore, scores 0,88 à 0,89),
**aucune fausse alerte** sur les mouvements normaux visibles (debout, marche, assis sur le lit, relevé, couché long après
une alerte). Total des deux sessions : **6 chutes détectées sur 8 jouées**. Les alertes de cette session portent la position
lue sur le PC (`CAMERA_LOCATION=auto`, précision 37 m), cohérente avec la carte de Sfax.

Réserves : très petit échantillon, une seule personne, une seule scène (lit), chutes vers l'avant et vers le lit, de face ;
pour la première session l'attribution des alertes aux essais vient des notes du testeur, **pas d'un enregistrement
vérifié** ; les 2 chutes manquées n'ont pas été analysées. Ces chiffres ne remplacent pas la mesure sur le jeu public ;
ils montrent que la chaîne fonctionne en direct.

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
