import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.api.routes_calls import router as calls_router
from app.api.routes_webhooks import router as webhooks_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.security import require_api_token
from app.db.session import get_db
from app.models.call import TranscriptTurn

setup_logging()
logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title="VoiceCall API", version="0.1.0")
app.include_router(calls_router)
app.include_router(webhooks_router)


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}


@app.get("/readyz", dependencies=[Depends(require_api_token)])
def readyz(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"ok": True}


@app.post("/v1/admin/retention", dependencies=[Depends(require_api_token)])
def enforce_retention(db: Session = Depends(get_db)) -> dict:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=settings.transcript_retention_days)
    stmt = delete(TranscriptTurn).where(TranscriptTurn.created_at < cutoff)
    result = db.execute(stmt)
    db.commit()
    deleted = result.rowcount or 0
    logger.info("Retention deleted turns=%s cutoff=%s", deleted, cutoff.isoformat())
    return {"ok": True, "deleted": deleted}
