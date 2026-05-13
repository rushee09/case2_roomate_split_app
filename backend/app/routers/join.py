import random
import string
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from .. import models

router = APIRouter()


def gen_cuid() -> str:
    import time
    ts = format(int(time.time() * 1000), 'x')
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    return f"c{ts}{rand}"


@router.get("/api/join")
def preview_group(
    code: str = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(models.Group.inviteCode == code.upper()).first()
    if not group:
        raise HTTPException(404, "Group not found")
    member_count = db.query(models.Member).filter(models.Member.groupId == group.id).count()
    return {"id": group.id, "name": group.name, "currency": group.currency, "memberCount": member_count, "inviteCode": group.inviteCode}


class JoinGroupBody(BaseModel):
    inviteCode: str


@router.post("/api/join", status_code=201)
def join_group(
    body: JoinGroupBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(models.Group.inviteCode == body.inviteCode.upper()).first()
    if not group:
        raise HTTPException(404, "Invalid invite code")

    existing = db.query(models.Member).filter(
        models.Member.groupId == group.id,
        models.Member.userId == user.id,
    ).first()
    if existing:
        raise HTTPException(409, detail={"error": "You are already a member of this group", "groupId": group.id})

    member = models.Member(
        id=gen_cuid(), name=user.name or user.username,
        email=user.email, groupId=group.id, userId=user.id,
        createdAt=datetime.utcnow(),
    )
    db.add(member)
    db.add(models.Activity(
        id=gen_cuid(), groupId=group.id, type="MEMBER_ADDED",
        data=f'{{"memberName":"{user.name or user.username}","joinedViaInvite":true}}',
        createdAt=datetime.utcnow(),
    ))
    db.commit()
    db.refresh(member)
    return {"group": {"id": group.id, "name": group.name}, "member": {"id": member.id, "name": member.name}}
