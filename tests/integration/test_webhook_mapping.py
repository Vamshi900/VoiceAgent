from app.models.call import CallStatus
from app.services.webhook_mapping import LIVEKIT_EVENT_TO_CALL_STATUS, TWILIO_STATUS_TO_CALL_STATUS


def test_twilio_status_mapping_covers_terminal_states() -> None:
    assert TWILIO_STATUS_TO_CALL_STATUS["completed"] == CallStatus.completed
    assert TWILIO_STATUS_TO_CALL_STATUS["failed"] == CallStatus.failed
    assert TWILIO_STATUS_TO_CALL_STATUS["busy"] == CallStatus.busy
    assert TWILIO_STATUS_TO_CALL_STATUS["no-answer"] == CallStatus.no_answer


def test_livekit_mapping_basics() -> None:
    assert LIVEKIT_EVENT_TO_CALL_STATUS["participant_joined"] == CallStatus.in_progress
    assert LIVEKIT_EVENT_TO_CALL_STATUS["room_finished"] == CallStatus.completed
