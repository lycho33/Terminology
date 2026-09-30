from typing import Annotated, Optional
from pydantic import AfterValidator, BaseModel

def check_not_empty(name: str) -> str:
    non_empty_name = name.strip()
    if not non_empty_name:
        raise ValueError(f'❌ The field cannot be empty or just spaces')
    return non_empty_name

NonEmptyName = Annotated[str, AfterValidator(check_not_empty)]

class Term(BaseModel):
    name: NonEmptyName
    definition: Optional[str] = None
    diagram: Optional[str] = None

class UpdateTermRequest(BaseModel):
    name: Optional[NonEmptyName] = None
    definition: Optional[str] = None
    diagram: Optional[str] = None

class ModelChatRequest(BaseModel):
    prompt: NonEmptyName
