"""Uniform error bodies with per-field messages.

Shape: {"detail": "<summary>", "errors": {"<field>": "<message>"}}

The default FastAPI 422 body echoes the submitted input back (which would
include passwords), so validation errors are rewritten here without it.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class FieldErrors(Exception):
    """Raise from a route to return field-level errors with a given status."""

    def __init__(self, status_code: int, detail: str, errors: dict[str, str]):
        self.status_code = status_code
        self.detail = detail
        self.errors = errors


def _field_errors_handler(request: Request, exc: FieldErrors) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "errors": exc.errors},
    )


def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors: dict[str, str] = {}
    for err in exc.errors():
        loc = [str(part) for part in err["loc"]]
        # Drop the leading "body"/"query"/"path" segment when a field follows it.
        field = ".".join(loc[1:]) if len(loc) > 1 else loc[0]
        message = err["msg"].removeprefix("Value error, ")
        errors.setdefault(field, message)
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation failed", "errors": errors},
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(FieldErrors, _field_errors_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
