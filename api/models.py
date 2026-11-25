from typing import Annotated, Optional
from pydantic import AfterValidator, BaseModel
from pydantic_core import PydanticCustomError
from .svg_diagram import validate_svg


def check_not_empty(name: str) -> str:
    non_empty_name = name.strip()
    if not non_empty_name:
        raise PydanticCustomError("blank_text", "Enter a value that is not blank.")
    return non_empty_name


NonEmptyName = Annotated[str, AfterValidator(check_not_empty)]
SvgDiagram = Annotated[str, AfterValidator(validate_svg)]


class Term(BaseModel):
    name: NonEmptyName
    definition: Optional[str] = None
    diagram: Optional[SvgDiagram] = None


class UpdateTermRequest(BaseModel):
    name: Optional[NonEmptyName] = None
    definition: Optional[str] = None
    diagram: Optional[SvgDiagram] = None


class ModelChatRequest(BaseModel):
    prompt: NonEmptyName
