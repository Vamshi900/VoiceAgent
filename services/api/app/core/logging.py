import logging

from pythonjsonlogger import jsonlogger


class PhoneMaskFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = str(record.getMessage())
        record.msg = _mask_phone_numbers(msg)
        return True


def _mask_phone_numbers(text: str) -> str:
    # Simple E.164-like masking for logs.
    out = []
    cur = ""
    for ch in text:
        if ch.isdigit() or ch == "+":
            cur += ch
            continue
        if cur:
            out.append(_mask_token(cur))
            cur = ""
        out.append(ch)
    if cur:
        out.append(_mask_token(cur))
    return "".join(out)


def _mask_token(token: str) -> str:
    digits = token.replace("+", "")
    if len(digits) < 8:
        return token
    return f"***{digits[-4:]}"


def setup_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    handler.addFilter(PhoneMaskFilter())
    root.handlers = [handler]
