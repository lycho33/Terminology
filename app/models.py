from pydantic import BaseModel

class Term(BaseModel):
    name: str
    # my_definition: str

class UpdateTermRequest(BaseModel):
    current_name: str
    updated_name: str