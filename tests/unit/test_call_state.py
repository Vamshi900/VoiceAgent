from app.models.call import CallStatus
from app.services.call_state import can_transition


def test_valid_transition_chain() -> None:
    assert can_transition(CallStatus.queued, CallStatus.dialing)
    assert can_transition(CallStatus.dialing, CallStatus.ringing)
    assert can_transition(CallStatus.ringing, CallStatus.in_progress)
    assert can_transition(CallStatus.in_progress, CallStatus.completed)


def test_invalid_transition_rejected() -> None:
    assert not can_transition(CallStatus.queued, CallStatus.completed)
    assert not can_transition(CallStatus.completed, CallStatus.in_progress)
