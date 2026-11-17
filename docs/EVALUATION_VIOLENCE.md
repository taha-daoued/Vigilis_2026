# Évaluation de la détection de violence (VideoMAE sur RLVS)

> Résultats réels, mesurés **une seule fois** sur le jeu de test verrouillé. RLVS est un jeu facile : ces chiffres
> ne disent rien sur une scène de démonstration (voir les limites).

## Méthode
- **Modèle** : VideoMAE-base (Kinetics-400) affiné sur Kaggle, 3 époques, 16 images par clip (`ai/violence/train_videomae.py`).
- **Données** : RLVS, 2 000 vidéos après retrait des doublons, découpage figé 1 400 / 300 / 300 (graine 2026).
  Le jeu de test (300 vidéos : 150 violentes, 150 non violentes) n'a jamais servi à l'entraînement ni au choix du modèle.
- **Seuil** : 0,5, fixé avant la mesure.
- **Mesure** : `ai/violence/evaluate_test.py`, une fois (fichier-témoin `data/rlvs/test_done.json`).
  Un premier lancement a planté sur 13 fichiers `.avi` ignorés par le script, **avant tout résultat** ; filtre corrigé, puis relancé.

## Résultats (test, 300 vidéos)
| Mesure | Valeur |
|---|---|
| Violences détectées (rappel) | 149 sur 150 (0,993) |
| Fausses alertes | 4 sur 150 vidéos normales |
| Précision | 0,974 |
| F1 | 0,984 |
| Exactitude | 0,983 |
| Temps d'inférence d'un clip | 7,1 s sur CPU (16 images) |

Erreurs : 4 fausses alertes (`NV_20`, `NV_558`, `NV_571`, `NV_687`) et 1 violence manquée (`V_738`, probabilité 0,485).

## Limites
- RLVS est facile et très homogène (vidéos de rue, de téléphone, de caméra). Un F1 de 0,98 est proche de la validation : il
  n'y a pas de surapprentissage visible, mais cela ne prédit pas la performance dans une scène de salon ou de démonstration.
- Pas encore de baseline comparée (jalon J11) ni de mesure sur vidéos maison.
- 7,1 s par clip sur CPU : pas de temps réel ; analyse par fenêtres toutes les 7 à 10 s au mieux sur ce PC.
- Licences : VideoMAE affiné sur RLVS (CC-BY-NC-4.0) : usage académique non commercial.

## Reproduire
```bash
cd ai
venv\Scripts\python.exe violence\benchmark_speed.py models\videomae_best.pt
venv\Scripts\python.exe violence\evaluate_test.py models\videomae_best.pt data\rlvs\real-life-violence-situations-dataset.zip
```
