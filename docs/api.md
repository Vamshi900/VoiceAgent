# API Contract

## Auth
All non-webhook endpoints require:
`Authorization: Bearer <API_AUTH_TOKEN>`

## Endpoints
### POST /v1/calls/outbound
Request:
```json
{
  "to": "+15555551234",
  "from": "+15555550123",
  "agent_profile_id": null,
  "context": {"customer_name": "Alex"},
  "metadata": {"campaign": "renewal"}
}
```
Response:
```json
{
  "call_id": "uuid",
  "status": "dialing",
  "room_name": "call-abc123"
}
```

### GET /v1/calls
Query: `status`, `limit`, `offset`

### GET /v1/calls/{call_id}
Returns full call details.

### GET /v1/calls/{call_id}/transcript
Returns ordered transcript turns.

### POST /v1/webhooks/twilio
Twilio callback endpoint; signature validated with `X-Twilio-Signature`.

### POST /v1/webhooks/livekit
LiveKit callback endpoint; signature validated with `X-Livekit-Signature` (base64 HMAC-SHA256).

### POST /v1/webhooks/internal/transcript
Internal endpoint for agent-worker to append transcript turns.
