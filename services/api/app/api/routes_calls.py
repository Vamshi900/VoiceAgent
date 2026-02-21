import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import require_api_token
from app.db.session import get_db
from app.models.call import CallStatus
from app.schemas.calls import (
    CallDetail,
    CallListResponse,
    CallResponse,
    OutboundCallRequest,
    TranscriptTurnResponse,
)
from app.services import calls as call_service
from app.services.livekit import generate_room_name, livekit_client
from app.services.phone import normalize_e164

router = APIRouter(prefix="/v1/calls", tags=["calls"], dependencies=[Depends(require_api_token)])
logger = logging.getLogger(__name__)


@router.post("/outbound", response_model=CallResponse)
async def create_outbound_call(request: OutboundCallRequest, db: Session = Depends(get_db)) -> CallResponse:
    settings = get_settings()
    try:
        to = normalize_e164(request.to)
        from_number = normalize_e164(request.from_number or settings.twilio_phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    room_name = generate_room_name(settings.livekit_default_room_prefix)
    request.to = to

    call = call_service.create_outbound_call(db, request, room_name, from_number)
    call_service.update_status(db, call, CallStatus.dialing)

    participant_identity = f"pstn-{str(call.id)[:8]}"
    try:
        try:
            dispatch_meta: dict = {"call_id": str(call.id), "phone_number": to}
            if request.convex_session_id:
                dispatch_meta["convex_session_id"] = request.convex_session_id
            await livekit_client.create_agent_dispatch(
                room_name=room_name,
                agent_name="phone-ai-agent",
                metadata=dispatch_meta,
            )
        except Exception:
            logger.warning("Agent dispatch creation failed for call_id=%s room=%s", call.id, room_name)

        # Pass Convex session ID and phone number for agent-worker intelligence bridge
        sip_metadata = {"call_id": str(call.id), "phone_number": to, **request.metadata}
        if request.convex_session_id:
            sip_metadata["convex_session_id"] = request.convex_session_id

        result = await livekit_client.create_outbound_sip_participant(
            room_name=room_name,
            to_number=to,
            from_number=from_number,
            participant_identity=participant_identity,
            metadata=sip_metadata,
        )
        if result.get("participant_id"):
            call.provider_sid = result["participant_id"]
            db.add(call)
            db.commit()
    except Exception as exc:
        logger.exception("Failed creating outbound SIP participant for call_id=%s", call.id)
        call_service.update_status(db, call, CallStatus.failed)
        raise HTTPException(status_code=502, detail="Failed to place outbound call") from exc

    latest = call_service.get_call(db, call.id)
    return CallResponse(call_id=latest.id, status=latest.status, room_name=latest.room_name)


@router.get("/{call_id}", response_model=CallDetail)
def get_call(call_id: UUID, db: Session = Depends(get_db)) -> CallDetail:
    call = call_service.get_call(db, call_id)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return CallDetail.model_validate(call, from_attributes=True)


@router.get("", response_model=CallListResponse)
def list_calls(
    status: CallStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> CallListResponse:
    items, total = call_service.list_calls(db, status, limit, offset)
    return CallListResponse(
        items=[CallDetail.model_validate(item, from_attributes=True) for item in items],
        total=total,
    )


@router.get("/{call_id}/transcript", response_model=list[TranscriptTurnResponse])
def get_transcript(call_id: UUID, db: Session = Depends(get_db)) -> list[TranscriptTurnResponse]:
    if not call_service.get_call(db, call_id):
        raise HTTPException(status_code=404, detail="Call not found")
    turns = call_service.list_transcript(db, call_id)
    return [TranscriptTurnResponse.model_validate(turn, from_attributes=True) for turn in turns]
