# Entraînement violence sur Kaggle

Le PC local a une connexion trop lente pour télécharger RLVS (3,85 Go). On travaille donc sur Kaggle, où le dataset est déjà présent. Aucune vidéo ne passe par Git (`ai/data/` est ignoré).

## Procédure
1. Kaggle → **Create → New Notebook**.
2. **Add Input** → chercher « Real Life Violence Situations Dataset » (`mohamedmustafa/real-life-violence-situations-dataset`) → Add. Le dataset apparaît sous `/kaggle/input/...`.
3. À droite : **Accelerator = GPU**, **Internet = On** (nécessaire pour `pip` et les poids pré-entraînés). Vérification du téléphone sur le compte parfois exigée par Kaggle pour activer Internet et le GPU.
4. Dans une cellule, copier `make_split.py` puis lancer :
   ```python
   !python make_split.py /kaggle/input/real-life-violence-situations-dataset split.csv
   ```
   La sortie affiche le nombre de vidéos par ensemble. **Notez ces chiffres** : ils sont réels, ne les inventez pas ailleurs.
5. Télécharger `split.csv` et le placer dans `ai/violence/` (petit fichier, peut aller dans Git). Le **test est ainsi figé** : ne jamais le régénérer avec une autre graine.

## Règles
- Le split `test` n'est utilisé qu'une fois, pour le résultat final.
- Aucune métrique n'est annoncée avant d'avoir été mesurée sur ce test.
- Licences : RWF-2000 non commercial sans accord ; vérifier celle de RLVS sur sa page Kaggle avant de publier un modèle.
- Les vidéos filmées par l'équipe (avec consentement) servent de second test, séparé.
