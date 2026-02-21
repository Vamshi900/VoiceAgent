import secrets

from fastapi import Cookie, HTTPException, Response

from dashboard.config import get_settings

SESSION_COOKIE = "dashboard_session"


def _session_value() -> str:
    settings = get_settings()
    return f"{settings.dashboard_username}:{settings.dashboard_password}"


def verify_credentials(username: str, password: str) -> bool:
    settings = get_settings()
    return secrets.compare_digest(username, settings.dashboard_username) and secrets.compare_digest(password, settings.dashboard_password)


def set_session_cookie(response: Response) -> None:
    response.set_cookie(SESSION_COOKIE, _session_value(), httponly=True, samesite="lax")


def require_session(session: str | None = Cookie(default=None, alias=SESSION_COOKIE)) -> None:
    if not is_session_valid(session):
        raise HTTPException(status_code=401, detail="Authentication required")


def is_session_valid(session: str | None) -> bool:
    if not session:
        return False
    return secrets.compare_digest(session, _session_value())
