"""Pose le rôle d'un compte Firebase : python -m scripts.set_role <email> <user|admin>

Utilise le compte de service défini dans backend/.env. Le jeton du compte ne change qu'à son
prochain rafraîchissement : se déconnecter / reconnecter pour voir le nouveau rôle.
"""
import sys

from firebase_admin import auth

from app.config import get_settings
from app.firebase_app import init_firebase
from app.roles import set_role

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    init_firebase(get_settings())
    uid = set_role(auth, sys.argv[1], sys.argv[2])
    print(f"rôle '{sys.argv[2]}' posé sur le compte {sys.argv[1]} (uid {uid})")
