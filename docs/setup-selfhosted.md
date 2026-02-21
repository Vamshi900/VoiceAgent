# Self-Hosted Setup

## 1. Prerequisites
- One Linux VM (recommended: 4 vCPU, 8 GB RAM).
- Docker + Docker Compose installed.
- Public DNS and TLS termination (Caddy/Nginx) for webhook endpoints.
- Twilio account with a voice-capable number.

## 2. Configure Environment
1. Copy `.env.example` to `.env`.
2. Fill required secrets:
- `API_AUTH_TOKEN`
- `TWILIO_*`
- `OPENAI_API_KEY`
- `WHISPER_BASE_URL`
- `WHISPER_API_KEY`
- `WHISPER_MODEL`
- `ELEVENLABS_API_KEY`
- `LIVEKIT_*`
3. Ensure `LIVEKIT_URL` and `LIVEKIT_WS_URL` match reachable internal service names for Compose.

## 3. Twilio SIP Trunk
1. Create Twilio Elastic SIP Trunk.
2. Add Origination URI that points to your LiveKit SIP ingress.
3. Attach your Twilio number to the trunk.
4. Configure Twilio status callback to:
- `POST https://<your-domain>/v1/webhooks/twilio`
5. Confirm signature validation with `X-Twilio-Signature` header enabled.

## 4. LiveKit SIP
- Edit `infra/livekit/livekit.yaml` with production `keys` and SIP settings.
- Set trunk ID in `.env` as `LIVEKIT_SIP_TRUNK_ID`.
- Configure webhook destination to:
- `POST https://<your-domain>/v1/webhooks/livekit`
- Use shared secret from `LIVEKIT_WEBHOOK_SECRET`.

## 5. Start Stack
```bash
cp .env.example .env
# update .env values
docker compose up --build -d
```

## 5.1 Local Whisper STT
- Run a local Whisper endpoint that supports OpenAI-style transcription API.
- Set `WHISPER_BASE_URL` in `.env` (example: `http://host.docker.internal:8001/v1`).
- Keep `WHISPER_API_KEY` to any accepted token for your local Whisper server.

## 6. Validate
- API health: `GET http://<host>:8000/healthz`
- Dashboard: `http://<host>:8080/login`
- Place outbound call via API and verify call status/transcript in dashboard.
