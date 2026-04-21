from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ai.agent import chat_with_agent
from database import get_db
from schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
  return chat_with_agent(db, payload.message, payload.thread_id)
