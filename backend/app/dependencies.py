from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from .database import get_db
from . import models


async def get_current_user(
    x_user_id: str = Header(alias="x-user-id"),
    db: Session = Depends(get_db),
) -> models.User:
    """
    Reads the x-user-id header injected by the Next.js proxy layer.
    The Next.js API routes validate the NextAuth session before adding this header,
    so FastAPI can trust it without re-validating auth.
    """
    user = db.query(models.User).filter(models.User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_group_member(group_id: str, user: models.User, db: Session) -> models.Member:
    """Returns the Member record if user belongs to the group, else 403."""
    member = db.query(models.Member).filter(
        models.Member.groupId == group_id,
        models.Member.userId == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    return member
