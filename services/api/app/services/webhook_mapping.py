from app.models.call import CallStatus


TWILIO_STATUS_TO_CALL_STATUS = {
    "queued": CallStatus.queued,
    "initiated": CallStatus.dialing,
    "ringing": CallStatus.ringing,
    "in-progress": CallStatus.in_progress,
    "completed": CallStatus.completed,
    "busy": CallStatus.busy,
    "no-answer": CallStatus.no_answer,
    "failed": CallStatus.failed,
    "canceled": CallStatus.canceled,
}

LIVEKIT_EVENT_TO_CALL_STATUS = {
    "participant_joined": CallStatus.in_progress,
    "room_finished": CallStatus.completed,
    "sip_call_failed": CallStatus.failed,
}
