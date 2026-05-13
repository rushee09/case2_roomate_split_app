import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from .. import models
from ..utils.email import send_group_invite_email
import os

router = APIRouter()


def gen_cuid() -> str:
    import time
    ts = format(int(time.time() * 1000), 'x')
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    return f"c{ts}{rand}"


class SendInviteBody(BaseModel):
    groupId: str
    username: str


@router.post("/api/invitations", status_code=201)
async def send_invitation(
    body: SendInviteBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify sender is a member
    membership = db.query(models.Member).filter(
        models.Member.groupId == body.groupId,
        models.Member.userId == user.id,
    ).first()
    if not membership:
        raise HTTPException(403, "You are not a member of this group")

    target = db.query(models.User).filter(models.User.username == body.username.lower()).first()
    if not target:
        raise HTTPException(404, "User not found")

    already_member = db.query(models.Member).filter(
        models.Member.groupId == body.groupId,
        models.Member.userId == target.id,
    ).first()
    if already_member:
        raise HTTPException(409, "User is already in this group")

    existing = db.query(models.GroupInvitation).filter(
        models.GroupInvitation.groupId == body.groupId,
        models.GroupInvitation.invitedUserId == target.id,
        models.GroupInvitation.status == "PENDING",
    ).first()
    if existing:
        raise HTTPException(409, "Invitation already sent")

    group = db.query(models.Group).filter(models.Group.id == body.groupId).first()
    if not group:
        raise HTTPException(404, "Group not found")

    import secrets
    token = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(days=7)

    invitation = models.GroupInvitation(
        id=gen_cuid(), groupId=body.groupId, invitedById=user.id,
        invitedEmail=target.email, invitedUserId=target.id,
        token=token, status="PENDING", expiresAt=expires_at,
        createdAt=datetime.utcnow(),
    )
    db.add(invitation)
    db.commit()

    app_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    accept_url = f"{app_url}/invitations/{token}"
    inviter_name = user.name or user.username

    await send_group_invite_email(
        to=target.email,
        inviter_name=inviter_name,
        group_name=group.name,
        accept_url=accept_url,
    )

    return {"ok": True, "invitationId": invitation.id}


@router.get("/api/invitations")
def list_invitations(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitations = db.query(models.GroupInvitation).filter(
        models.GroupInvitation.invitedUserId == user.id,
        models.GroupInvitation.status == "PENDING",
    ).order_by(models.GroupInvitation.createdAt.desc()).all()

    result = []
    for inv in invitations:
        group = db.query(models.Group).filter(models.Group.id == inv.groupId).first()
        inviter = db.query(models.User).filter(models.User.id == inv.invitedById).first()
        member_count = db.query(models.Member).filter(models.Member.groupId == inv.groupId).count()
        result.append({
            "id": inv.id,
            "token": inv.token,
            "group": {
                "id": group.id, "name": group.name, "currency": group.currency,
                "_count": {"members": member_count},
            } if group else None,
            "invitedBy": {
                "username": inviter.username, "name": inviter.name, "image": inviter.image,
            } if inviter else None,
        })
    return result


@router.post("/api/invitations/{token}/accept")
def accept_invitation(
    token: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation = db.query(models.GroupInvitation).filter(models.GroupInvitation.token == token).first()
    if not invitation:
        raise HTTPException(404, "Invitation not found")
    if invitation.status != "PENDING":
        raise HTTPException(410, "Invitation is no longer valid")
    if datetime.utcnow() > invitation.expiresAt:
        invitation.status = "EXPIRED"
        db.commit()
        raise HTTPException(410, "Invitation has expired")
    if invitation.invitedUserId and invitation.invitedUserId != user.id:
        raise HTTPException(403, "This invitation is for a different user")

    already_member = db.query(models.Member).filter(
        models.Member.groupId == invitation.groupId,
        models.Member.userId == user.id,
    ).first()

    if not already_member:
        db.add(models.Member(
            id=gen_cuid(), name=user.name or user.username,
            email=user.email, groupId=invitation.groupId, userId=user.id,
            createdAt=datetime.utcnow(),
        ))
        db.add(models.Activity(
            id=gen_cuid(), groupId=invitation.groupId, type="MEMBER_JOINED",
            data=f'{{"memberName":"{user.name or user.username}"}}',
            createdAt=datetime.utcnow(),
        ))

    invitation.status = "ACCEPTED"
    db.commit()
    return {"ok": True, "groupId": invitation.groupId}


@router.post("/api/invitations/{token}/decline")
def decline_invitation(
    token: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation = db.query(models.GroupInvitation).filter(models.GroupInvitation.token == token).first()
    if not invitation or invitation.invitedUserId != user.id:
        raise HTTPException(404, "Invitation not found")
    if invitation.status != "PENDING":
        raise HTTPException(410, "Invitation is no longer valid")
    invitation.status = "DECLINED"
    db.commit()
    return {"ok": True}
