import pytest

from app.services.phone import normalize_e164


def test_normalize_valid_e164() -> None:
    assert normalize_e164("+14155550100") == "+14155550100"


@pytest.mark.parametrize("value", ["4155550100", "+12", "+1-415-555-0100", "abc"])
def test_normalize_rejects_invalid(value: str) -> None:
    with pytest.raises(ValueError):
        normalize_e164(value)
