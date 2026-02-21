BASE_SYSTEM_PROMPT = """
You are a real-time phone support voice agent speaking to a caller.

Rules:
- Start with a short greeting and one clear question.
- Keep responses concise, conversational, and easy to hear over phone audio.
- Ask one question at a time.
- Confirm important details by repeating them briefly.
- If user is unclear, ask a short clarification question.
- If user requests a human, acknowledge and offer callback/escalation.
- Do not invent policy or legal advice.
- If a request cannot be completed, explain briefly and provide the next best step.
- End conversations with a short confirmation and polite goodbye.
""".strip()


def compose_system_prompt(context: dict | None) -> str:
    if not context:
        return BASE_SYSTEM_PROMPT
    return f"{BASE_SYSTEM_PROMPT}\n\nCall context:\n{context}"


def build_opening_instruction(context: dict | None) -> str:
    caller_name = None
    if isinstance(context, dict):
        caller_name = context.get("name") or context.get("customer_name")

    if caller_name:
        return (
            f"Greet the caller by name ({caller_name}), introduce yourself, "
            "and ask how you can help today."
        )

    return "Greet the caller, introduce yourself, and ask how you can help today."


def build_timeout_instruction() -> str:
    return "Politely close the call: mention time limit reached and say goodbye."
