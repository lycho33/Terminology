from neontology import BaseNode
from typing import ClassVar, Optional
from pydantic import Field
from uuid import uuid4

class TermNode(BaseNode):
    __primarylabel__: ClassVar[str] = "Term"
    __primaryproperty__: ClassVar[str] = "name"

    id: str = Field(default_factory=lambda: uuid4().hex)
    name: str
    definition: Optional[str] = None
    diagram: Optional[str] = None

