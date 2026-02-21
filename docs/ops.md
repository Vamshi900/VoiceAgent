# Operations Runbook

## Start / Stop
```bash
docker compose up --build -d
docker compose ps
docker compose logs -f api agent-worker dashboard livekit-server
docker compose down
```

## Key Troubleshooting
- Outbound call fails immediately:
  - Verify `LIVEKIT_SIP_TRUNK_ID`.
  - Check API logs for `/twirp/livekit.SIP/CreateSIPParticipant` errors.
- No transcripts:
  - Ensure agent-worker can call `http://api:8000/v1/webhooks/internal/transcript`.
  - Verify `API_AUTH_TOKEN` matches across services.
- Webhook 401s:
  - Twilio: confirm `TWILIO_AUTH_TOKEN` and callback URL.
  - LiveKit: confirm `LIVEKIT_WEBHOOK_SECRET` and signature header.

## Secret Rotation
1. Rotate secrets in `.env`.
2. Restart impacted services:
```bash
docker compose up -d --force-recreate api agent-worker dashboard
```
3. Re-run smoke call.

## Retention Cleanup
Trigger transcript retention manually:
```bash
curl -X POST http://localhost:8000/v1/admin/retention \
  -H "Authorization: Bearer $API_AUTH_TOKEN"
```
