"""Découpage figé train / val / test du dataset RLVS.

Le jeu de test est décidé UNE SEULE FOIS (graine fixe, fichiers triés) puis jamais
utilisé pendant l'entraînement. Le script n'ouvre pas les vidéos : il ne fait que lister
les fichiers, donc il tourne aussi bien sur Kaggle que sur le PC.

Structure attendue (celle de Kaggle) :
    <racine>/.../Violence/V_1.mp4        -> label 1
    <racine>/.../NonViolence/NV_1.mp4    -> label 0

Usage : python make_split.py <racine> <sortie.csv>
"""
import csv
import random
import sys
from pathlib import Path

SEED = 2026
RATIOS = (0.70, 0.15, 0.15)  # train, val, test
VIDEO_EXT = {".mp4", ".avi", ".mkv"}


def label_of(path: Path):
    """1 = violence, 0 = pas de violence, None = dossier ignoré."""
    parents = {p.name.lower() for p in path.parents}
    if "nonviolence" in parents:  # à tester avant "violence" (même mot contenu)
        return 0
    if "violence" in parents:
        return 1
    return None


def split_files(root: Path, seed: int = SEED):
    """Retourne une liste de (chemin relatif, label, split), triée et reproductible."""
    by_label = {0: [], 1: []}
    for p in sorted(root.rglob("*")):
        if p.suffix.lower() in VIDEO_EXT:
            lab = label_of(p.relative_to(root))
            if lab is not None:
                by_label[lab].append(p.relative_to(root).as_posix())

    rows = []
    rng = random.Random(seed)
    for lab, files in by_label.items():  # découpage par classe : proportions conservées
        files = sorted(files)
        rng.shuffle(files)
        n_train = int(len(files) * RATIOS[0])
        n_val = int(len(files) * RATIOS[1])
        for i, f in enumerate(files):
            split = "train" if i < n_train else "val" if i < n_train + n_val else "test"
            rows.append((f, lab, split))
    return sorted(rows)


def main(root: str, out: str):
    rows = split_files(Path(root))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["path", "label", "split"])
        w.writerows(rows)
    for s in ("train", "val", "test"):
        n = [r for r in rows if r[2] == s]
        print(f"{s}: {len(n)} vidéos ({sum(r[1] for r in n)} violentes)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
