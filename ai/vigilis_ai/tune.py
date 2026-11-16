"""Balaye des réglages des règles de chute sur un dossier de vidéos DÉJÀ évalué (pose en cache).

  python -m vigilis_ai.tune data/gmdcsa24_eval/dev --confirm-s 2

Pour chaque combinaison de seuils : chutes détectées et fausses alertes. Rapide (la pose est en cache).
ATTENTION au surapprentissage : ne balayez que sur un jeu de RÉGLAGE ; mesurez ensuite UNE fois sur un jeu
mis de côté (ex. le sujet 4 de GMDCSA24) sans rien changer. Un réglage choisi sur les vidéos qu'on présente
donne un résultat flatteur.
"""
import argparse
import itertools
from dataclasses import replace
from pathlib import Path

from vigilis_ai.evaluate import VIDEO_EXT, detect, expected_for, load_manifest
from vigilis_ai.fall import FallParams
from vigilis_ai.replay import load

GRID = {
    "min_drop_torso": [0.8, 0.6, 0.4, 0.3],
    "lying_min_deg": [60.0, 50.0, 40.0],
    "still_range_torso": [0.5, 1.0, 1.5],
    "upright_max_deg": [35.0, 45.0],
}


def run_grid(videos: dict[str, tuple], expected: dict[str, str], base: FallParams, grid: dict[str, list]) -> list[dict]:
    """videos : nom -> (images, taille). Renvoie une ligne par combinaison, avec les comptes."""
    keys = list(grid)
    out = []
    for values in itertools.product(*(grid[k] for k in keys)):
        changes = dict(zip(keys, values))
        if "lying_min_deg" in changes:
            changes["still_lying_min_deg"] = changes["lying_min_deg"] - 10  # reste un peu plus tolérant une fois au sol
        prm = replace(base, **changes)
        caught = false_alarms = n_pos = n_neg = 0
        for name, (frames, size) in videos.items():
            n_alerts = len(detect(frames, size, prm)[0])
            if expected[name] == "alerte":
                n_pos += 1
                caught += n_alerts >= 1
            else:
                n_neg += 1
                false_alarms += n_alerts >= 1
        out.append({**{k: changes[k] for k in keys}, "caught": caught, "n_pos": n_pos, "false_alarms": false_alarms, "n_neg": n_neg})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--confirm-s", type=float, default=10.0)
    ap.add_argument("--top", type=int, default=12)
    args = ap.parse_args()
    folder = Path(args.folder)
    manifest = load_manifest(folder)
    videos, expected = {}, {}
    for v in sorted(p for p in folder.iterdir() if p.suffix.lower() in VIDEO_EXT):
        cache = folder / "pose_cache" / f"{v.stem}.csv"
        if not cache.exists():
            raise SystemExit(f"Pas de cache pour {v.name} : lancez d'abord vigilis_ai.evaluate sur ce dossier.")
        videos[v.name], expected[v.name] = load(str(cache)), expected_for(v.stem, manifest)
    rows = run_grid(videos, expected, FallParams(confirm_s=args.confirm_s), GRID)
    rows.sort(key=lambda r: (r["false_alarms"], -r["caught"]))  # peu de fausses alertes d'abord, puis le plus de chutes
    keys = list(GRID)
    print(f"{len(rows)} combinaisons, immobilité {args.confirm_s:.0f} s, {rows[0]['n_pos']} chutes et {rows[0]['n_neg']} vidéos normales")
    print("  ".join(f"{k[:12]:>12}" for k in keys), "  chutes  fausses alertes")
    for r in rows[: args.top]:
        print("  ".join(f"{r[k]:>12}" for k in keys), f"  {r['caught']:>3}/{r['n_pos']}   {r['false_alarms']:>3}/{r['n_neg']}")
    print("\nMeilleur compromis par nombre de fausses alertes autorisées :")
    for fa in (0, 2, 5, 10):
        ok = [r for r in rows if r["false_alarms"] <= fa]
        if ok:
            best = max(ok, key=lambda r: r["caught"])
            print(f"  jusqu'à {fa:>2} fausses alertes : {best['caught']}/{best['n_pos']} chutes  " + str({k: best[k] for k in keys}))


if __name__ == "__main__":
    main()
