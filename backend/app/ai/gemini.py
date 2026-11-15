"""Thin wrapper around the Gemini API for JSON-schema-constrained replies."""

from functools import lru_cache

from app.core.config import settings


class GeminiError(Exception):
    """The request failed or came back without a usable result."""


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


@lru_cache
def _client():
    from google import genai

    return genai.Client(api_key=settings.gemini_api_key)


def generate_json(system_instruction: str, text: str, schema: dict) -> str:
    """One request; returns the raw JSON reply constrained to `schema`."""
    try:
        interaction = _client().interactions.create(
            model=settings.gemini_model,
            system_instruction=system_instruction,
            input=text,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": schema,
            },
        )
    except Exception as exc:
        raise GeminiError(f"Gemini request failed: {exc}") from exc
    if interaction.status != "completed" or not interaction.output_text:
        raise GeminiError(f"Gemini returned no result (status: {interaction.status})")
    return interaction.output_text
