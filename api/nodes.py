from typing import Optional
from pydantic import BaseModel, Field
from uuid import uuid4


class TermNode(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    definition: Optional[str] = None
    diagram: Optional[str] = None
