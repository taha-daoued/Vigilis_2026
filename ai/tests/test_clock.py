"""Tests de l'horloge des images (fausse capture vidéo, aucun fichier)."""
import cv2

from vigilis_ai.clock import DEFAULT_FPS, FrameClock


class FakeCap:
    def __init__(self, fps=30.0, pos_msec=None):
        self.fps, self.pos_msec_values = fps, list(pos_msec or [])

    def get(self, prop):
        if prop == cv2.CAP_PROP_FPS:
            return self.fps
        if prop == cv2.CAP_PROP_POS_MSEC:
            return self.pos_msec_values.pop(0) if self.pos_msec_values else 0.0
        return 0.0


def test_file_time_follows_the_video_timestamps_not_the_computer():
    clock = FrameClock(FakeCap(pos_msec=[0, 33.3, 66.7, 100.0]), is_file=True)
    assert [round(clock.tick(), 3) for _ in range(4)] == [0.0, 0.033, 0.067, 0.1]


def test_file_time_falls_back_to_frame_number_when_timestamps_are_missing():
    clock = FrameClock(FakeCap(fps=30.0, pos_msec=[]), is_file=True)  # le format ne donne pas d'horodatage
    assert [round(clock.tick(), 3) for _ in range(4)] == [0.0, 0.033, 0.067, 0.1]


def test_absurd_frame_rate_uses_the_default():
    assert FrameClock(FakeCap(fps=0.0), is_file=True).fps == DEFAULT_FPS
    assert FrameClock(FakeCap(fps=1000.0), is_file=True).fps == DEFAULT_FPS


def test_webcam_time_is_the_real_clock_and_increases():
    clock = FrameClock(FakeCap(), is_file=False)
    a, b = clock.tick(), clock.tick()
    assert 0 <= a <= b < 5
