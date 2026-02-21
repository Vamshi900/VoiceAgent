import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, Float, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CallDirection(str, Enum):
    inbound = "inbound"
    outbound = "outbound"


class CallStatus(str, Enum):
    queued = "queued"
    dialing = "dialing"
    ringing = "ringing"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    no_answer = "no_answer"
    busy = "busy"
    canceled = "canceled"


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    direction: Mapped[CallDirection] = mapped_column(SAEnum(CallDirection), nullable=False)
    to_number: Mapped[str] = mapped_column(String(32), nullable=False)
    from_number: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_sid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    room_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[CallStatus] = mapped_column(SAEnum(CallStatus), nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_sec: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    context_json: Mapped[dict] = mapped_column(JSON, default=dict)
    agent_profile_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class TranscriptTurn(Base):
    __tablename__ = "transcript_turns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int] = mapped_column(nullable=False)
    end_ms: Mapped[int] = mapped_column(nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class AgentProfile(Base):
    __tablename__ = "agent_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    voice_id: Mapped[str] = mapped_column(String(64), nullable=False)
    language: Mapped[str] = mapped_column(String(16), default="en")
    model_config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    safety_config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
