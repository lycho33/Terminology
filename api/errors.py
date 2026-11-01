"""Application-owned error codes. Do not expose package errors or input values."""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from neo4j.exceptions import ServiceUnavailable, SessionExpired


class ErrorDetail(BaseModel):
    code: str
    field: str | None
    message: str


class ErrorResponse(BaseModel):
    detail: str
    errors: list[ErrorDetail]


class ApiProblem(Exception):
    def __init__(self, status: int, code: str, message: str, field: str | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.field = field


def error_response(status: int, message: str, errors: list[dict]) -> JSONResponse:
    return JSONResponse(
        status_code=status, content={"detail": message, "errors": errors}
    )


async def api_problem_handler(request: Request, exc: ApiProblem) -> JSONResponse:
    return error_response(
        exc.status,
        exc.message,
        [{"code": exc.code, "field": exc.field, "message": exc.message}],
    )


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Validates the data, the user submits follows these rules"""
    messages = {
        "missing": ("FIELD_REQUIRED", "This field is required."),
        "blank_text": ("FIELD_BLANK", "Enter a value that is not blank."),
        "string_type": ("INVALID_TYPE", "Enter text for this field."),
        "json_invalid": ("INVALID_JSON", "The request must contain valid JSON."),
    }
    errors = []
    for error in exc.errors():
        code, message = messages.get(
            error["type"], ("INVALID_VALUE", "Check this value.")
        )
        location = error["loc"]
        # Body-level errors have no matching form field.
        field = ".".join(str(part) for part in location[1:]) or None
        if code == "INVALID_JSON":
            field = None
        errors.append({"code": code, "field": field, "message": message})
    return error_response(422, "Check the submitted fields.", errors)


async def database_error_handler(request: Request, exc: Exception) -> JSONResponse:
    unavailable = isinstance(exc, (ServiceUnavailable, SessionExpired))
    code = "DATABASE_UNAVAILABLE" if unavailable else "DATABASE_ERROR"
    message = (
        "The database is unavailable. Try again."
        if unavailable
        else "The database operation failed."
    )
    return error_response(
        503 if unavailable else 500,
        message,
        [{"code": code, "field": None, "message": message}],
    )
