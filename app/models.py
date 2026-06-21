from typing import Optional

from pydantic import BaseModel

class Term(BaseModel):
    name: str
    definition: Optional[str] = None
    diagram: Optional[str] = None

class UpdateTermRequest(BaseModel):
    name: Optional[str] = None
    definition: Optional[str] = None
    diagram: Optional[str] = None