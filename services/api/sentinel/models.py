from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict


class Node(BaseModel):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[\w-]+$")
    type: str
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})
    data: dict[str, Any] = Field(default_factory=dict)


class Edge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None


class Graph(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    nodes: list[Node] = Field(min_length=1, max_length=100)
    edges: list[Edge] = Field(max_length=200)
    version: int = 0
    published: bool = False


class RunRequest(BaseModel):
    workflow_id: str
    version: int
    mode: Literal["simulation", "live", "audit"] = "simulation"
    scenario: Literal["normal", "dispute", "unauthorized", "injection"] = "injection"
    seed: int = 42
    agent_id: str | None = None
    recipient: str | None = None
    authorized: bool = False
    recording_id: str | None = None
    attack_id: str | None = Field(default=None, max_length=80, pattern=r"^[\w-]+$")


class ToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tool: Literal[
        "get_account_status",
        "create_payment_dispute",
        "register_contact_preference",
        "request_human_escalation",
    ]
    account_id: str
    subject_id: str
    verified: bool = False
    idempotency_key: str = Field(min_length=8, max_length=128)
