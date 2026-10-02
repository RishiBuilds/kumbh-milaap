from __future__ import annotations

import base64
import io
import os
import re
import secrets
from typing import Callable

import qrcode
from qrcode.constants import ERROR_CORRECT_M

ID_PREFIX = "KM"
EVENT_YEAR = 2027
ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
ID_LENGTH = 6
MAX_ID_ATTEMPTS = 10

QR_BOX_SIZE = 10
QR_BORDER = 4

BASE_URL_ENV = "CASE_BASE_URL"

_CASE_ID_PATTERN = re.compile(
    rf"^{ID_PREFIX}-{EVENT_YEAR}-[{ID_ALPHABET}]{{{ID_LENGTH}}}$"
)


def is_valid_case_id(case_id: str) -> bool:
    return bool(_CASE_ID_PATTERN.fullmatch(case_id))


def generate_case_id(exists: Callable[[str], bool] | None = None) -> str:
    for _ in range(MAX_ID_ATTEMPTS):
        suffix = "".join(secrets.choice(ID_ALPHABET) for _ in range(ID_LENGTH))
        case_id = f"{ID_PREFIX}-{EVENT_YEAR}-{suffix}"
        if exists is None or not exists(case_id):
            return case_id
    raise RuntimeError("Unable to generate a unique case ID")


def build_case_url(case_id: str, base_url: str | None = None) -> str:
    base = (base_url if base_url is not None else os.environ.get(BASE_URL_ENV, "")).strip()
    if not base:
        return case_id
    return f"{base.rstrip('/')}/case/{case_id}"


def generate_qr_code(
    case_id: str,
    case_url: str = "",
    error_correction: int = ERROR_CORRECT_M,
) -> str:
    if not is_valid_case_id(case_id):
        raise ValueError(f"Invalid case ID: {case_id!r}")

    content = case_url.strip() or build_case_url(case_id)

    qr = qrcode.QRCode(
        version=None,
        error_correction=error_correction,
        box_size=QR_BOX_SIZE,
        border=QR_BORDER,
    )
    qr.add_data(content)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def generate_qr_data_uri(case_id: str, case_url: str = "") -> str:
    return f"data:image/png;base64,{generate_qr_code(case_id, case_url)}"