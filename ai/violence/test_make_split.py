"""Tests du découpage figé (sur de faux fichiers vides, aucune vidéo réelle)."""
from pathlib import Path

from make_split import label_of, split_files


def fake_dataset(root: Path, n_v=20, n_nv=20):
    for cls, prefix, n in (("Violence", "V", n_v), ("NonViolence", "NV", n_nv)):
        d = root / "Real Life Violence Dataset" / cls
        d.mkdir(parents=True)
        for i in range(n):
            (d / f"{prefix}_{i}.mp4").touch()
    (root / "notes.txt").touch()  # fichier non vidéo : ignoré


def test_label_nonviolence_not_confused_with_violence(tmp_path):
    assert label_of(Path("x/NonViolence/NV_1.mp4")) == 0
    assert label_of(Path("x/Violence/V_1.mp4")) == 1
    assert label_of(Path("x/Autre/a.mp4")) is None


def test_split_is_deterministic(tmp_path):
    fake_dataset(tmp_path)
    assert split_files(tmp_path) == split_files(tmp_path)


def test_every_video_in_exactly_one_split(tmp_path):
    fake_dataset(tmp_path)
    rows = split_files(tmp_path)
    assert len(rows) == 40
    assert len({r[0] for r in rows}) == 40


def test_split_is_stratified(tmp_path):
    fake_dataset(tmp_path)
    rows = split_files(tmp_path)
    for split in ("train", "val", "test"):
        labels = [r[1] for r in rows if r[2] == split]
        assert sum(labels) * 2 == len(labels)  # autant de violentes que de normales


def test_test_set_is_never_empty_and_seed_changes_it(tmp_path):
    fake_dataset(tmp_path)
    a = {r[0] for r in split_files(tmp_path, seed=1) if r[2] == "test"}
    b = {r[0] for r in split_files(tmp_path, seed=2) if r[2] == "test"}
    assert a and b and a != b
