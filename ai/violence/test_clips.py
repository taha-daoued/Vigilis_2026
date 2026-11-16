import numpy as np

from clips import sample_indices


def test_eval_indices_are_regular_and_reproducible():
    a = sample_indices(160, 16)
    assert list(a) == list(sample_indices(160, 16))
    assert len(a) == 16 and list(a) == sorted(a)
    assert a.min() >= 0 and a.max() <= 159


def test_train_indices_stay_in_their_segment_and_in_range():
    rng = np.random.default_rng(0)
    for total in (16, 17, 150, 1000):
        idx = sample_indices(total, 16, train=True, rng=rng)
        assert len(idx) == 16 and idx.min() >= 0 and idx.max() <= total - 1
        assert list(idx) == sorted(idx)


def test_short_video_repeats_last_frame():
    idx = sample_indices(5, 16)
    assert len(idx) == 16 and idx.max() == 4 and list(idx[:5]) == [0, 1, 2, 3, 4]


def test_empty_video_is_an_error():
    try:
        sample_indices(0)
        assert False
    except ValueError:
        pass
