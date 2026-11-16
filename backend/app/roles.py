"""Pose du rôle (custom claim « role ») sur un compte Firebase. Seul le serveur peut le faire."""

VALID_ROLES = {"user", "admin"}


def set_role(auth_api, email: str, role: str) -> str:
    """Pose le rôle sur le compte ayant cet e-mail et renvoie son uid.

    Les autres claims existants sont conservés. `auth_api` est le module
    firebase_admin.auth (ou un faux dans les tests).
    """
    if role not in VALID_ROLES:
        raise ValueError(f"rôle inconnu : {role}")
    user = auth_api.get_user_by_email(email)
    claims = dict(user.custom_claims or {})
    claims["role"] = role
    auth_api.set_custom_user_claims(user.uid, claims)
    return user.uid
