import os
import garminconnect
from dotenv import load_dotenv

load_dotenv()

_client: garminconnect.Garmin | None = None


def get_client() -> garminconnect.Garmin:
    """Returns a logged-in Garmin client (singleton)."""
    global _client
    if _client is not None:
        return _client

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        raise RuntimeError(
            "GARMIN_EMAIL and GARMIN_PASSWORD must be set in garmin_service/.env"
        )

    client = garminconnect.Garmin(email=email, password=password)

    try:
        # Try loading saved tokens first (avoids login on restart)
        client.login()
    except Exception:
        # Tokens not saved or expired — do a fresh login
        client.login()

    _client = client
    return _client


def reset_client() -> None:
    """Force re-authentication on next get_client() call."""
    global _client
    _client = None
