"""Range GMDCSA24 pour l'évaluation : un dossier de réglage (sujets 1 à 3) et un dossier final (sujet 4).

  python -m vigilis_ai.prepare_gmdcsa24 data/gmdcsa24 data/gmdcsa24_eval

Crée data/gmdcsa24_eval/dev/ et data/gmdcsa24_eval/final/ avec des liens vers les vidéos (pas de copie),
renommées S1_fall_01.mp4 / S1_adl_01.mp4, et un labels.csv : file, expected (alerte pour Fall, aucune pour ADL),
note (description de l'auteur), after_fall_s (secondes de vidéo après le début de la chute).
Dataset : GMDCSA24 (Alam et al., 2024, licence MIT) : à citer dans le rapport.
Le sujet 4 sert aux chiffres finaux : ne réglez AUCUN seuil dessus.
"""
import argparse
import csv
import os
import re
import shutil
from pathlib import Path

DEV_SUBJECTS, FINAL_SUBJECTS = (1, 2, 3), (4,)
FALL_RE = re.compile(r"Fall\w*[^\[;]*\[\s*([\d.]+)\s*to\s*([\d.]+)\s*\]", re.IGNORECASE)


def parse_row(line: str) -> dict | None:
    """Une ligne des CSV de l'auteur. La description contient des virgules : on lit les champs aux deux bouts."""
    parts = [p.strip() for p in line.strip().split(",")]
    if len(parts) < 6 or not parts[0].lower().endswith(".mp4"):
        return None
    try:
        length = float(parts[1])
    except ValueError:
        return None
    classes = parts[-1]
    m = FALL_RE.search(classes)
    return {"file": parts[0], "length_s": length, "note": ", ".join(parts[4:-1]),
            "after_fall_s": round(length - float(m.group(1)), 1) if m else ""}


def read_annotations(csv_path: Path) -> list[dict]:
    if not csv_path.exists():
        return []
    with open(csv_path, encoding="utf-8-sig") as fh:
        next(fh, None)  # en-tête
        return [r for r in (parse_row(line) for line in fh) if r]


def link_or_copy(src: Path, dst: Path) -> None:
    if dst.exists():
        return
    try:
        os.link(src, dst)  # même disque : aucune place supplémentaire
    except OSError:
        shutil.copy2(src, dst)


def prepare(src: Path, out: Path) -> dict[str, int]:
    counts = {}
    for name, subjects in (("dev", DEV_SUBJECTS), ("final", FINAL_SUBJECTS)):
        folder = out / name
        folder.mkdir(parents=True, exist_ok=True)
        rows = []
        for s in subjects:
            for kind, expected in (("Fall", "alerte"), ("ADL", "aucune")):
                ann = {r["file"]: r for r in read_annotations(src / f"Subject {s}" / f"{kind}.csv")}
                for video in sorted((src / f"Subject {s}" / kind).glob("*.mp4")):
                    new = f"S{s}_{kind.lower()}_{video.stem}.mp4"
                    link_or_copy(video, folder / new)
                    a = ann.get(video.name, {})
                    rows.append({"file": new, "expected": expected, "note": a.get("note", ""),
                                 "after_fall_s": a.get("after_fall_s", "") if kind == "Fall" else ""})
        with open(folder / "labels.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["file", "expected", "note", "after_fall_s"])
            w.writeheader()
            w.writerows(rows)
        counts[name] = len(rows)
    return counts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="dossier GMDCSA24 cloné")
    ap.add_argument("out", help="dossier de sortie")
    args = ap.parse_args()
    counts = prepare(Path(args.src), Path(args.out))
    print(f"Réglage (sujets 1-3) : {counts['dev']} vidéos | Final (sujet 4) : {counts['final']} vidéos")


if __name__ == "__main__":
    main()
