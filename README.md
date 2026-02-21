# VoiceCall

Self-hosted phone calling platform with LiveKit + Twilio + AI voice agent.

## Services
- `services/api`: FastAPI call orchestration, webhooks, persistence.
- `services/agent-worker`: LiveKit voice agent worker (Deepgram + OpenAI + ElevenLabs).
- `services/dashboard`: Basic operations dashboard.
- `infra/livekit`: LiveKit server config.

## Quick Start
```bash
cp .env.example .env
# edit .env
docker compose up --build
```

API docs are in `docs/api.md`.
