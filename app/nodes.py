from neontology import BaseNode
from typing import ClassVar, Optional

class TermNode(BaseNode):
    __primarylabel__: ClassVar[str] = "Term"
    __primaryproperty__: ClassVar[str] = "name"

    name: str
    definition: Optional[str] = None
    diagram: Optional[str] = None