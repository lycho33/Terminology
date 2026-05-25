from neontology import BaseNode
from typing import ClassVar

class TermNode(BaseNode):
    __primarylabel__: ClassVar[str] = "Term"
    __primaryproperty__: ClassVar[str] = "name"

    name: str