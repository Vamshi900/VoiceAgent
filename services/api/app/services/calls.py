from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.call import Call, CallDirection, CallStatus, TranscriptTurn
from app.schemas.calls import OutboundCallRequest
from app.services.call_state import can_transition


def create_outbound_call(
    db: Session,
    request: OutboundCallRequest,
    room_name: str,
    from_number: str,
) -> Call:
    call = Call(
        direction=CallDirection.outbound,
        to_number=request.to,
        from_number=from_number,
        room_name=room_name,
        status=CallStatus.queued,
        metadata_json=request.metadata,
        context_json=request.context,
        agent_profile_id=request.agent_profile_id,
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def create_inbound_call(
    db: Session,
    room_name: str,
    to_number: str,
    from_number: str,
    provider_sid: str | None,
    metadata: dict | None = None,
) -> Call:
    call = Call(
        direction=CallDirection.inbound,
        to_number=to_number,
        from_number=from_number,
        room_name=room_name,
        status=CallStatus.ringing,
        provider_sid=provider_sid,
        metadata_json=metadata or {},
        context_json={},
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def get_call(db: Session, call_id: UUID) -> Call | None:
    return db.get(Call, call_id)


def list_calls(
    db: Session,
    status: CallStatus | None,
    limit: int,
    offset: int,
) -> tuple[list[Call], int]:
    stmt = select(Call).order_by(Call.created_at.desc()).limit(limit).offset(offset)
    count_stmt = select(func.count()).select_from(Call)
    if status:
        stmt = stmt.where(Call.status == status)
        count_stmt = count_stmt.where(Call.status == status)

    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def update_status(
    db: Session,
    call: Call,
    new_status: CallStatus,
    provider_sid: str | None = None,
) -> Call:
    if not can_transition(call.status, new_status):
        return call

    now = datetime.now(tz=timezone.utc)
    if call.status != CallStatus.in_progress and new_status == CallStatus.in_progress:
        call.started_at = now
    if new_status in {
        CallStatus.completed,
        CallStatus.failed,
        CallStatus.no_answer,
        CallStatus.busy,
        CallStatus.canceled,
    }:
        call.ended_at = now
        if call.started_at:
            call.duration_sec = max((call.ended_at - call.started_at).total_seconds(), 0.0)
    call.status = new_status
    if provider_sid:
        call.provider_sid = provider_sid

    db.add(call)
    db.commit()
    db.refresh(call)
    return call


def list_transcript(db: Session, call_id: UUID) -> list[TranscriptTurn]:
    stmt = (
        select(TranscriptTurn)
        .where(TranscriptTurn.call_id == call_id)
        .order_by(TranscriptTurn.start_ms.asc(), TranscriptTurn.created_at.asc())
    )
    return list(db.scalars(stmt).all())


def add_transcript_turn(
    db: Session,
    call_id: UUID,
    speaker: str,
    text: str,
    start_ms: int,
    end_ms: int,
    confidence: float = 1.0,
) -> TranscriptTurn:
    turn = TranscriptTurn(
        call_id=call_id,
        speaker=speaker,
        text=text,
        start_ms=start_ms,
        end_ms=end_ms,
        confidence=confidence,
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    return turn
