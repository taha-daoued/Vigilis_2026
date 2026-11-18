# Protocole : vidéos maison pour évaluer et améliorer la violence

Objectif : mesurer (et, si possible, améliorer) la détection de violence sur **vos propres scènes** (intérieur, caméra
fixe), car le modèle entraîné sur RLVS ne détecte pas une bagarre jouée (voir `docs/EVALUATION_VIOLENCE.md`).

## Règles (non négociables)
- **Aucune violence réelle** : toute scène « violence » est **jouée, sans contact**. Personne ne doit se faire mal.
- **Consentement** : chaque personne filmée donne son accord oral (ou écrit) avant le tournage, sait que les clips
  restent **sur votre PC**, servent au PFE, et peuvent être supprimés à sa demande. Noter la date et les noms (sans les
  mettre dans le dépôt).
- **Rien ne sort de l'ordinateur** : pas d'envoi sur Kaggle, YouTube ni un autre service. Les clips sont dans
  `ai/data/clips_maison/` (ignoré par git). Si un entraînement en ligne devient nécessaire, il faut un nouvel accord explicite.
- **Pas de mineurs** ; pas de tiers reconnaissables en arrière-plan.
- Durée de conservation à décider avec l'encadrant ; suppression après la soutenance (`ai/data/clips_maison/`).

## Ce qu'il faut tourner
Deux jeux, **tournés à des moments différents** (autres vêtements, autre éclairage si possible) :

| Jeu | Rôle | Violence jouée | Normal | Total |
|---|---|---|---|---|
| `train` | affiner / calibrer | 20 clips | 20 clips | 40 |
| `test` | mesure finale, **jamais utilisé pour entraîner** | 10 clips | 10 clips | 20 |

- Clips de 6 s, caméra fixe à 2-3 m, personnes entières dans l'image.
- **Violence jouée** : varier (coups de poing mimés, bousculade, saisie de bras, poussée retenue, bagarre à terre sans
  contact) et la vitesse ; 1 ou 2 personnes. Pas seulement ce que le modèle sait déjà.
- **Normal** : marcher, discuter, se serrer la main, danser, jouer, porter un objet, faire du sport, s'asseoir,
  se lever, se bousculer en riant (cas difficiles, importants pour les fausses alertes).

## Enregistrer (webcam fermée dans `view` avant : touche q)
```bash
cd ai
venv\Scripts\python.exe -m vigilis_ai.clips_maison --classe violence --n 10 --seconds 6
venv\Scripts\python.exe -m vigilis_ai.clips_maison --classe normal --n 10 --seconds 6
# plus tard, à un autre moment : les clips de TEST
venv\Scripts\python.exe -m vigilis_ai.clips_maison --classe violence --n 10 --split test
venv\Scripts\python.exe -m vigilis_ai.clips_maison --classe normal --n 10 --split test
```
Un compte à rebours de 3 s laisse le temps de se placer ; un point rouge indique l'enregistrement.

## Ensuite (à faire une fois les clips tournés)
1. Mesurer d'abord le modèle actuel sur les clips `test`, **sans rien changer** (point de départ honnête).
2. Affiner **en local** (pas d'envoi) sur les clips `train`, avec un échantillon de RLVS pour ne pas tout oublier.
3. Mesurer **une seule fois** sur `test`, comparer avant/après, et vérifier qu'il n'y a pas de régression sur RLVS.
4. Annoncer les chiffres tels quels, même s'ils sont mauvais.
