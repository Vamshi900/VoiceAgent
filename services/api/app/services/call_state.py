from app.models.call import CallStatus

TERMINAL_STATES = {
    CallStatus.completed,
    CallStatus.failed,
    CallStatus.no_answer,
    CallStatus.busy,
    CallStatus.canceled,
}

ALLOWED_TRANSITIONS: dict[CallStatus, set[CallStatus]] = {
    CallStatus.queued: {CallStatus.dialing, CallStatus.failed, CallStatus.canceled, CallStatus.completed},
    CallStatus.dialing: {CallStatus.ringing, CallStatus.failed, CallStatus.no_answer, CallStatus.busy, CallStatus.canceled, CallStatus.completed},
    CallStatus.ringing: {CallStatus.in_progress, CallStatus.no_answer, CallStatus.busy, CallStatus.canceled, CallStatus.failed, CallStatus.completed},
    CallStatus.in_progress: {CallStatus.completed, CallStatus.failed, CallStatus.canceled},
    CallStatus.completed: set(),
    CallStatus.failed: set(),
    CallStatus.no_answer: set(),
    CallStatus.busy: set(),
    CallStatus.canceled: set(),
}


def can_transition(current: CallStatus, next_status: CallStatus) -> bool:
    if current == next_status:
        return True
    return next_status in ALLOWED_TRANSITIONS[current]
