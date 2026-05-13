import re
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from .. import models

router = APIRouter()

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,20}$')


@router.get("/api/users/me")
def get_me(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "id": user.id, "username": user.username,
        "name": user.name, "email": user.email, "image": user.image,
    }


class UpdateMeBody(BaseModel):
    username: str


@router.patch("/api/users/me")
def update_me(
    body: UpdateMeBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not USERNAME_RE.match(body.username):
        raise HTTPException(400, "Username must be 3–20 characters: letters, numbers, underscores only.")

    lower = body.username.lower()
    taken = db.query(models.User).filter(
        models.User.username == lower,
        models.User.id != user.id,
    ).first()
    if taken:
        raise HTTPException(409, "Username is already taken.")

    user.username = lower
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "name": user.name, "email": user.email, "image": user.image}


@router.get("/api/users/search")
def search_users(
    q: str = Query(default="", min_length=2),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).filter(
        models.User.username.contains(q.lower()),
        models.User.id != user.id,
    ).limit(10).all()
    return [{"id": u.id, "username": u.username, "name": u.name, "image": u.image, "email": u.email} for u in users]
