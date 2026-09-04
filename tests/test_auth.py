import jwt
import pytest

from src.registry.auth import (
    authenticate, create_user, decode_token, hash_password, issue_token,
    may_write, verify_password,
)


def test_password_hash_is_salted_and_verifies():
    a, b = hash_password("correct horse"), hash_password("correct horse")
    assert a != b  # distinct salts
    assert verify_password("correct horse", a)
    assert not verify_password("wrong horse", a)


def test_overlong_password_is_rejected_not_an_error(cur):
    """bcrypt raises above 72 bytes. Login must answer 'no', not crash."""
    create_user(cur, email="c@gujarat.gov.in", password="s3cret", role="viewer")
    assert verify_password("x" * 73, hash_password("s3cret")) is False
    assert authenticate(cur, "c@gujarat.gov.in", "x" * 500) is None


def test_token_round_trips_claims():
    claims = decode_token(issue_token(user_id=7, role="dept_admin", department_id=3))
    assert claims["sub"] == "7"
    assert claims["role"] == "dept_admin"
    assert claims["dept"] == 3


def test_expired_token_is_rejected():
    import datetime as dt

    from src.registry.config import load_settings

    settings = load_settings()
    now = dt.datetime.now(dt.UTC)
    expired = jwt.encode(
        {"sub": "1", "role": "viewer", "exp": now - dt.timedelta(seconds=1), "iat": now - dt.timedelta(hours=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expired)


def test_token_signed_with_another_secret_is_rejected():
    forged = jwt.encode(
        {"sub": "1", "role": "state_admin"},
        "a-different-key-also-at-least-32-bytes",
        algorithm="HS256",
    )
    with pytest.raises(jwt.PyJWTError):
        decode_token(forged)


def test_authenticate_returns_the_user_on_correct_password(cur, department):
    create_user(cur, email="a@gujarat.gov.in", password="s3cret",
                role="dept_admin", department_id=department)
    user = authenticate(cur, "a@gujarat.gov.in", "s3cret")
    assert user["role"] == "dept_admin"
    assert user["department_id"] == department


def test_authenticate_returns_none_on_bad_password_or_unknown_email(cur):
    create_user(cur, email="b@gujarat.gov.in", password="s3cret", role="viewer")
    assert authenticate(cur, "b@gujarat.gov.in", "wrong") is None
    assert authenticate(cur, "nobody@gujarat.gov.in", "s3cret") is None


@pytest.mark.parametrize(
    "role, own_dept, target_dept, expected",
    [
        ("state_admin", None, 5, True),
        ("dept_admin", 5, 5, True),
        ("dept_admin", 5, 6, False),
        ("viewer", 5, 5, False),
    ],
)
def test_write_permission_rules(role, own_dept, target_dept, expected):
    claims = {"role": role, "dept": own_dept}
    assert may_write(claims, target_dept) is expected
