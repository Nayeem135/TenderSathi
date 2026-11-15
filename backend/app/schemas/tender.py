from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TenderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    firm_id: int
    title: str
    status: str
    uploaded_at: datetime
