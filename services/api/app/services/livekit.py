import json
import time
import uuid

import httpx
import jwt

from app.core.config import get_settings


class LiveKitClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _auth_token(self, room_name: str) -> str:
        now = int(time.time())
        payload = {
            "iss": self.settings.livekit_api_key,
            "sub": "voicecall-api",
            "nbf": now,
            "exp": now + 3600,
            "video": {
                "room": room_name,
                "roomAdmin": True,
                "roomCreate": True,
                "canPublish": True,
                "canSubscribe": True,
            },
            "sip": {
                "admin": True,
                "call": True,
            },
        }
        return jwt.encode(payload, self.settings.livekit_api_secret, algorithm="HS256")

    async def create_outbound_sip_participant(
        self,
        room_name: str,
        to_number: str,
        from_number: str,
        participant_identity: str,
        metadata: dict,
    ) -> dict:
        token = self._auth_token(room_name)
        url = f"{self.settings.livekit_url}/twirp/livekit.SIP/CreateSIPParticipant"
        payload = {
            "sip_trunk_id": self.settings.livekit_sip_trunk_id,
            "sip_call_to": to_number,
            "room_name": room_name,
            "participant_identity": participant_identity,
            "participant_name": "Phone Caller",
            "krisp_enabled": False,
            "wait_until_answered": False,
            "headers": {
                "X-From-Number": from_number,
            },
            "attributes": {k: str(v) for k, v in metadata.items()},
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        response.raise_for_status()
        return response.json()

    async def create_agent_dispatch(
        self,
        room_name: str,
        agent_name: str,
        metadata: dict | None = None,
    ) -> dict:
        token = self._auth_token(room_name)
        url = f"{self.settings.livekit_url}/twirp/livekit.AgentDispatchService/CreateDispatch"
        payload = {
            "room": room_name,
            "agent_name": agent_name,
            "metadata": json.dumps(metadata or {}),
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
        response.raise_for_status()
        return response.json()


livekit_client = LiveKitClient()


def generate_room_name(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"
