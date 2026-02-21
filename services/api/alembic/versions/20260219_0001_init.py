"""init schema

Revision ID: 20260219_0001
Revises: 
Create Date: 2026-02-19 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260219_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    call_direction = postgresql.ENUM("inbound", "outbound", name="calldirection", create_type=False)
    call_status = postgresql.ENUM(
        "queued",
        "dialing",
        "ringing",
        "in_progress",
        "completed",
        "failed",
        "no_answer",
        "busy",
        "canceled",
        name="callstatus",
        create_type=False,
    )
    call_direction.create(op.get_bind(), checkfirst=True)
    call_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "calls",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("direction", call_direction, nullable=False),
        sa.Column("to_number", sa.String(length=32), nullable=False),
        sa.Column("from_number", sa.String(length=32), nullable=False),
        sa.Column("provider_sid", sa.String(length=64), nullable=True),
        sa.Column("room_name", sa.String(length=128), nullable=False),
        sa.Column("status", call_status, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Float(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("context_json", sa.JSON(), nullable=False),
        sa.Column("agent_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_calls_status", "calls", ["status"])
    op.create_index("ix_calls_room_name", "calls", ["room_name"])

    op.create_table(
        "transcript_turns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("call_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("speaker", sa.String(length=16), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_transcript_turns_call_id", "transcript_turns", ["call_id"])
    op.create_index("ix_transcript_turns_created_at", "transcript_turns", ["created_at"])

    op.create_table(
        "agent_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("voice_id", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("model_config_json", sa.JSON(), nullable=False),
        sa.Column("safety_config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("agent_profiles")
    op.drop_index("ix_transcript_turns_created_at", table_name="transcript_turns")
    op.drop_index("ix_transcript_turns_call_id", table_name="transcript_turns")
    op.drop_table("transcript_turns")
    op.drop_index("ix_calls_room_name", table_name="calls")
    op.drop_index("ix_calls_status", table_name="calls")
    op.drop_table("calls")
    postgresql.ENUM(name="callstatus", create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="calldirection", create_type=False).drop(op.get_bind(), checkfirst=True)
