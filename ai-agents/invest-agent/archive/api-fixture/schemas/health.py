from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^ok$")
    service: str = Field(pattern="^financial-ai-agent-api$")
    generatedAt: str
    dataAsOf: str
    sourceLabel: str
    isMock: bool
    paperOnly: bool
    externalConnections: int = Field(ge=0, le=0)
    executed: bool
    disclaimer: str
