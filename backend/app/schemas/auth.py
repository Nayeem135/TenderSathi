from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import MAX_PASSWORD_BYTES


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    firm_name: str = Field(max_length=255)

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("password")
    @classmethod
    def _password_rules(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isalpha() for c in value):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one digit")
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes long")
        return value

    @field_validator("firm_name")
    @classmethod
    def _firm_name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Firm name is required")
        return value


class LoginRequest(BaseModel):
    # Plain strings on purpose: a malformed email at login gets the same
    # generic 401 as any other bad credential.
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FirmOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    firm_id: int | None
    firm: FirmOut | None
    created_at: datetime
