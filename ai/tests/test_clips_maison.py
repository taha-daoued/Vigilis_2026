"""Nommage des clips maison : ne jamais écraser un clip existant."""
from vigilis_ai.clips_maison import next_name


def test_premier_clip(tmp_path):
    assert next_name(tmp_path, "violence").name == "violence_0001.mp4"


def test_continue_apres_le_dernier_sans_ecraser(tmp_path):
    for n in (1, 2, 7):
        (tmp_path / f"violence_{n:04d}.mp4").write_bytes(b"x")
    assert next_name(tmp_path, "violence").name == "violence_0008.mp4"


def test_ignore_les_autres_noms(tmp_path):
    (tmp_path / "violence_abc.mp4").write_bytes(b"x")
    (tmp_path / "normal_0009.mp4").write_bytes(b"x")
    assert next_name(tmp_path, "violence").name == "violence_0001.mp4"
