import datetime

import bcrypt
import jwt

from .config import JWT_TTL_SECONDS, load_settings

# bcrypt refuses input over 72 bytes rather than truncating it.
BCRYPT_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    # hash_password cannot have produced a hash for an over-length password, so
    # such an input matches nothing. Rejecting it here keeps login returning 401
    # instead of letting bcrypt's ValueError surface as a 500.
    if len(plain.encode()) > BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def issue_token(*, user_id: int, role: str, department_id: int | None) -> str:
    settings = load_settings()
    now = datetime.datetime.now(datetime.UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "role": role,
            "dept": department_id,
            "iat": now,
            "exp": now + datetime.timedelta(seconds=JWT_TTL_SECONDS),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, load_settings().jwt_secret, algorithms=["HS256"])


def create_user(cur, *, email: str, password: str, role: str = "viewer",
                department_id: int | None = None) -> int:
    cur.execute(
        "INSERT INTO app_user (email, password_hash, role, department_id)"
        " VALUES (%s, %s, %s, %s) RETURNING id",
        (email, hash_password(password), role, department_id),
    )
    return cur.fetchone()["id"]


def authenticate(cur, email: str, password: str) -> dict | None:
    cur.execute(
        "SELECT id, email, password_hash, role::text AS role, department_id"
        " FROM app_user WHERE email = %s",
        (email,),
    )
    row = cur.fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return {"id": row["id"], "email": row["email"], "role": row["role"],
            "department_id": row["department_id"]}


def may_write(claims: dict, department_id: int | None) -> bool:
    """The single source of truth for write permission. The API layer must not
    reimplement any part of this."""
    role = claims.get("role")
    if role == "state_admin":
        return True
    if role == "dept_admin":
        return department_id is not None and claims.get("dept") == department_id
    return False
