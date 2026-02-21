import json
import logging
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import require_api_token, verify_livekit_signature, verify_twilio_signature
from app.db.session import get_db
from app.models.call import Call, CallStatus
from app.services import calls as call_service
from app.services.webhook_mapping import LIVEKIT_EVENT_TO_CALL_STATUS, TWILIO_STATUS_TO_CALL_STATUS

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/twilio")
async def twilio_status_callback(
    request: Request,
    x_twilio_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    raw_body = await request.body()
    form = await request.form()
    verify_twilio_signature(str(request.url), dict(form), x_twilio_signature)

    call_id_raw = form.get("CallSid") or form.get("call_id")
    call_status_raw = (form.get("CallStatus") or "").lower()
    if not call_status_raw:
        raise HTTPException(status_code=400, detail="Missing CallStatus")

    mapped = TWILIO_STATUS_TO_CALL_STATUS.get(call_status_raw)
    if not mapped:
        return {"ok": True, "ignored": True}

    call = None
    if call_id_raw:
        try:
            call = call_service.get_call(db, uuid.UUID(str(call_id_raw)))
        except ValueError:
            call = None

    if not call and (provider_sid := form.get("CallSid")):
        # Lightweight lookup path for provider SID matching.
        from sqlalchemy import select
        from app.models.call import Call

        stmt = select(Call).where(Call.provider_sid == provider_sid)
        call = db.scalar(stmt)

    if not call:
        logger.warning("Twilio webhook unmatched sid=%s payload=%s", form.get("CallSid"), raw_body.decode("utf-8", errors="ignore"))
        return {"ok": True, "ignored": True}

    call_service.update_status(db, call, mapped, provider_sid=form.get("CallSid"))
    return {"ok": True}


@router.post("/livekit")
async def livekit_webhook(
    request: Request,
    x_livekit_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    body = await request.body()
    # NOTE: temporary bypass for local testing when LiveKit Cloud signing secret
    # cannot be configured in UI. Re-enable signature validation for production.
    # verify_livekit_signature(body, x_livekit_signature)

    payload = json.loads(body.decode("utf-8"))
    event = payload.get("event")
    room_name = payload.get("room", {}).get("name") or payload.get("room_name")

    call_id_raw = None
    attrs = payload.get("participant", {}).get("attributes", {})
    if isinstance(attrs, dict):
        call_id_raw = attrs.get("call_id")

    if not call_id_raw:
        # Resolve by room name for events like `room_finished` where participant
        # attributes are not present.
        if room_name and event in LIVEKIT_EVENT_TO_CALL_STATUS:
            from sqlalchemy import select

            stmt = select(Call).where(Call.room_name == room_name).limit(1)
            by_room = db.scalar(stmt)
            if by_room:
                call_service.update_status(db, by_room, LIVEKIT_EVENT_TO_CALL_STATUS[event])
                return {"ok": True, "call_id": str(by_room.id)}

        if event == "participant_joined":
            from sqlalchemy import select

            stmt = select(Call).where(Call.room_name == room_name).limit(1)
            existing = db.scalar(stmt)
            if existing:
                return {"ok": True}

            to_number = attrs.get("to_number", "unknown")
            from_number = attrs.get("from_number", "unknown")
            provider_sid = payload.get("participant", {}).get("sid")
            call = call_service.create_inbound_call(
                db=db,
                room_name=room_name or "unknown-room",
                to_number=to_number,
                from_number=from_number,
                provider_sid=provider_sid,
                metadata={k: str(v) for k, v in attrs.items()},
            )
            call_service.update_status(db, call, CallStatus.in_progress)
            return {"ok": True, "call_id": str(call.id)}
        return {"ok": True, "ignored": True}

    try:
        call_id = uuid.UUID(str(call_id_raw))
    except ValueError:
        return {"ok": True, "ignored": True}

    call = call_service.get_call(db, call_id)
    if not call:
        return {"ok": True, "ignored": True}

    if event in LIVEKIT_EVENT_TO_CALL_STATUS:
        call_service.update_status(db, call, LIVEKIT_EVENT_TO_CALL_STATUS[event])

    return {"ok": True}


@router.post("/internal/transcript", dependencies=[Depends(require_api_token)])
def internal_add_transcript(payload: dict, db: Session = Depends(get_db)) -> dict:
    try:
        call_id = uuid.UUID(str(payload["call_id"]))
        speaker = str(payload["speaker"])
        text = str(payload["text"])
        start_ms = int(payload["start_ms"])
        end_ms = int(payload["end_ms"])
        confidence = float(payload.get("confidence", 1.0))
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid payload") from exc

    if not call_service.get_call(db, call_id):
        raise HTTPException(status_code=404, detail="Call not found")

    turn = call_service.add_transcript_turn(db, call_id, speaker, text, start_ms, end_ms, confidence)
    return {"ok": True, "id": str(turn.id)}
