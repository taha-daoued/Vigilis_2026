"""Tests du rangement de GMDCSA24 sur un faux dossier (quelques lignes copiées de la documentation du jeu de données)."""
from vigilis_ai.evaluate import load_manifest
from vigilis_ai.prepare_gmdcsa24 import parse_row, prepare, read_annotations

FALL = ("01.mp4,06, Day (Light On),Full T-shirt & Trousers, Falling from sitting on the chair to the ground. "
        "Left side Fall. Full body not visible, Falling (SW)[3.4 to 6]; Sitting[0 to 3.4]")
ADL = ("02.mp4,06, Day (Light On), Full T-shirt & Trousers, Sitting on the bed to sleeping left side on the bed. "
       "Face towards the camera, Sitting[0 to 0.5]; Sleeping[1.5 to 6]")
HEADER = "File Name,Length (seconds),Time of Recording,Attire,Description, Classes\n"


def test_fall_row_gives_time_left_after_the_fall_starts():
    r = parse_row(FALL)
    assert r["file"] == "01.mp4" and r["length_s"] == 6.0 and r["after_fall_s"] == 2.6
    assert "Full body not visible" in r["note"] and "Falling from sitting" in r["note"]


def test_adl_row_has_no_fall_interval():
    r = parse_row(ADL)
    assert r["file"] == "02.mp4" and r["after_fall_s"] == "" and "sleeping left side" in r["note"]


def test_bad_lines_are_ignored():
    assert parse_row("") is None and parse_row("pas,un,csv") is None and parse_row("x.mp4,abc,a,b,c,d") is None


def test_prepare_splits_by_subject_and_labels_each_video(tmp_path):
    src, out = tmp_path / "src", tmp_path / "out"
    for s in (1, 4):
        for kind, row in (("Fall", FALL), ("ADL", ADL)):
            d = src / f"Subject {s}" / kind
            d.mkdir(parents=True)
            name = row.split(",")[0]
            (d / name).write_bytes(b"fausse video")
            (src / f"Subject {s}" / f"{kind}.csv").write_text(HEADER + row + "\n", encoding="utf-8")
    counts = prepare(src, out)
    assert counts == {"dev": 2, "final": 2}  # le sujet 1 va au réglage, le sujet 4 à la mesure finale
    assert (out / "dev" / "S1_fall_01.mp4").exists() and (out / "final" / "S4_adl_02.mp4").exists()
    assert not (out / "dev" / "S4_fall_01.mp4").exists()  # aucune vidéo du sujet 4 dans le dossier de réglage
    assert load_manifest(out / "dev") == {"S1_fall_01": "alerte", "S1_adl_02": "aucune"}  # lisible par evaluate.py


def test_annotations_file_is_read(tmp_path):
    p = tmp_path / "Fall.csv"
    p.write_text(HEADER + FALL + "\n", encoding="utf-8")
    assert [r["file"] for r in read_annotations(p)] == ["01.mp4"]
