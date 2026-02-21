import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.call import CallDirection, CallStatus


class OutboundCallRequest(BaseModel):
    to: str = Field(description="E.164 destination phone number")
    from_number: str | None = Field(default=None, alias="from")
    agent_profile_id: uuid.UUID | None = None
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CallResponse(BaseModel):
    call_id: uuid.UUID
    status: CallStatus
    room_name: str


class CallDetail(BaseModel):
    id: uuid.UUID
    direction: CallDirection
    to_number: str
    from_number: str
    provider_sid: str | None
    room_name: str
    status: CallStatus
    started_at: datetime | None
    ended_at: datetime | None
    duration_sec: float | None
    metadata_json: dict[str, Any]
    context_json: dict[str, Any]
    agent_profile_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class CallListResponse(BaseModel):
    items: list[CallDetail]
    total: int


class TranscriptTurnResponse(BaseModel):
    id: uuid.UUID
    call_id: uuid.UUID
    speaker: str
    text: str
    start_ms: int
    end_ms: int
    confidence: float
    created_at: datetime
