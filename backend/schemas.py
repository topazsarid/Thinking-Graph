from typing import Annotated, Literal, Union
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from .extraction import Proposal

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]
Summary = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]

class Command(BaseModel):
    model_config = ConfigDict(extra='forbid')
    commandId: UUID

class CreateContainer(Command):
    action: Literal['workspace', 'conversation']
    title: Title

class CreateMessage(Command):
    action: Literal['message']
    content: Content
    conversationId: UUID
    workspaceId: UUID
    extractRules: bool = True

class ReviewExtraction(Command):
    action: Literal['review-extraction']
    runId: UUID
    proposal: Proposal
    bindings: dict[str, UUID] = Field(default_factory=dict, max_length=24)

class ReviseIdea(Command):
    action: Literal['idea']
    id: UUID
    title: Title
    summary: Summary
    status: Literal['proposed', 'accepted', 'rejected']

class CreateIdea(Command):
    action: Literal['create-idea']
    workspaceId: UUID
    title: Title
    summary: str = Field(default='', max_length=4000)
    kind: Literal['idea', 'question'] = 'idea'

class LinkIdea(Command):
    action: Literal['link']
    ideaId: UUID
    workspaceId: UUID
    messageId: UUID | None = None

class CreateConnection(Command):
    action: Literal['connection']
    label: Title
    ideaIds: list[UUID] = Field(min_length=2, max_length=12)
    typeId: UUID | None = None
    description: str = Field(default='', max_length=4000)
    suggestion: str = Field(default='', max_length=4000)
    missed: bool = False
    typeName: Title | None = None
    parentId: UUID | None = None
    addAlias: bool = False

class ReviseConnection(Command):
    action: Literal['revise-connection']
    id: UUID
    label: Title
    description: str = Field(default='', max_length=4000)

class ConnectionVisibility(Command):
    action: Literal['connection-visibility']
    id: UUID
    deleted: bool

class SaveNote(Command):
    action: Literal['note']
    id: UUID | None = None
    title: Title
    content: Content
    kind: Literal['general', 'task'] | None = None

class CompleteNote(Command):
    action: Literal['complete-note']
    id: UUID
    completed: bool

class SnapshotNotes(Command):
    action: Literal['snapshot-notes']
    noteIds: list[UUID] = Field(min_length=1, max_length=12)
    workspaceId: UUID

class ConversationPreference(Command):
    action: Literal['conversation-preference']
    id: UUID
    preference: str = Field(default='', max_length=1000)

class RelationType(Command):
    action: Literal['relation-type']
    id: UUID | None = None
    title: Title
    description: str = Field(default='', max_length=4000)
    parentId: UUID | None = None

GraphCommand = Annotated[Union[CreateContainer, CreateMessage, ReviseIdea, LinkIdea,
                                CreateConnection, ReviseConnection, ConnectionVisibility, SaveNote, CompleteNote, SnapshotNotes, RelationType, ReviewExtraction, CreateIdea, ConversationPreference], Field(discriminator='action')]
