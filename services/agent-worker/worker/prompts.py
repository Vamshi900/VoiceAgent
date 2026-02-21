"""System prompts for the CVS X-Ray Booking voice agent.

When running in Convex mode, the Convex intelligence layer handles the full
agent logic (tools, booking, state). These prompts provide the base persona
for the voice pipeline's local LLM (used for filler/fallback and STT context).
"""

BASE_SYSTEM_PROMPT = """
You are a friendly outbound phone agent for CVS Health calling patients
about discounted X-Ray imaging appointments.

Rules:
- Introduce yourself briefly as calling from CVS Health regarding a special
  imaging discount.
- Keep responses concise — one short sentence at a time for natural phone audio.
- Ask one question at a time and wait for the patient's response.
- Confirm important details (center choice, date, time) by repeating them.
- If the patient sounds hesitant, acknowledge their concern before continuing.
- If the patient requests a human, say you will transfer them right away.
- Never invent medical advice, pricing, or availability.
- If something cannot be completed, explain briefly and offer an alternative.
- End conversations with a confirmation summary and polite goodbye.
""".strip()


def compose_system_prompt(context: dict | None) -> str:
    """Build the full system prompt with optional call context."""
    if not context:
        return BASE_SYSTEM_PROMPT

    extra = []
    if context.get("name"):
        extra.append(f"Patient name: {context['name']}")
    if context.get("phone"):
        extra.append(f"Phone: {context['phone']}")
    if context.get("centers"):
        center_lines = []
        for c in context["centers"]:
            center_lines.append(f"  - {c.get('name', 'Center')}: ${c.get('discount', 0)} off")
        extra.append("Available centers:\n" + "\n".join(center_lines))

    if extra:
        return f"{BASE_SYSTEM_PROMPT}\n\nCall context:\n" + "\n".join(extra)
    return f"{BASE_SYSTEM_PROMPT}\n\nCall context:\n{context}"


def build_opening_instruction(context: dict | None) -> str:
    """Build the opening greeting instruction."""
    caller_name = None
    if isinstance(context, dict):
        caller_name = context.get("name") or context.get("customer_name") or context.get("prospectName")

    if caller_name:
        return (
            f"Greet the patient by name ({caller_name}). Say you are calling from "
            "CVS Health about a special discount on X-Ray imaging. Ask if now is a "
            "good time to talk."
        )

    return (
        "Greet the caller. Say you are calling from CVS Health about a special "
        "discount on X-Ray imaging. Ask if now is a good time to talk."
    )


def build_timeout_instruction() -> str:
    """Build the timeout close instruction."""
    return (
        "We are running up on time. Summarize what was discussed, confirm any "
        "next steps, and politely end the call with a goodbye."
    )
