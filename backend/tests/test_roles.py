import pytest

from app.roles import set_role


class FakeUser:
    def __init__(self, uid, custom_claims=None):
        self.uid, self.custom_claims = uid, custom_claims


class FakeAuth:
    def __init__(self, users):
        self.users, self.calls = users, []

    def get_user_by_email(self, email):
        return self.users[email]

    def set_custom_user_claims(self, uid, claims):
        self.calls.append((uid, claims))


def test_set_role_admin_keeps_other_claims():
    api = FakeAuth({"a@x": FakeUser("u1", {"equipe": "nuit"})})
    assert set_role(api, "a@x", "admin") == "u1"
    assert api.calls == [("u1", {"equipe": "nuit", "role": "admin"})]


def test_set_role_works_without_existing_claims():
    api = FakeAuth({"a@x": FakeUser("u1", None)})
    set_role(api, "a@x", "user")
    assert api.calls == [("u1", {"role": "user"})]


def test_unknown_role_is_refused_and_nothing_is_written():
    api = FakeAuth({"a@x": FakeUser("u1")})
    with pytest.raises(ValueError):
        set_role(api, "a@x", "superadmin")
    assert api.calls == []
