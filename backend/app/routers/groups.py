import json
import math
import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_group_member
from .. import models
from ..balance import calculate_balances, minimize_settlements

router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def gen_cuid() -> str:
    import time
    ts = format(int(time.time() * 1000), 'x')
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=16))
    return f"c{ts}{rand}"


def gen_invite_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def to_paise(inr: float) -> int:
    return round(inr * 100)


def log_activity(db: Session, group_id: str, event_type: str, data: dict):
    db.add(models.Activity(
        id=gen_cuid(), groupId=group_id, type=event_type,
        data=json.dumps(data), createdAt=datetime.utcnow(),
    ))


# ─── Groups ──────────────────────────────────────────────────────────────────

class CreateGroupBody(BaseModel):
    name: str
    currency: str = "INR"


class UpdateGroupBody(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None


@router.get("/api/groups")
def list_groups(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    members = db.query(models.Member).filter(models.Member.userId == user.id).all()
    group_ids = [m.groupId for m in members]

    groups = db.query(models.Group).filter(models.Group.id.in_(group_ids)).order_by(
        models.Group.createdAt.desc()
    ).all()

    result = []
    for g in groups:
        member_count = db.query(models.Member).filter(models.Member.groupId == g.id).count()
        expense_count = db.query(models.Expense).filter(models.Expense.groupId == g.id).count()
        result.append({
            "id": g.id, "name": g.name, "currency": g.currency,
            "inviteCode": g.inviteCode, "createdAt": g.createdAt.isoformat(),
            "_count": {"members": member_count, "expenses": expense_count},
        })
    return result


@router.post("/api/groups", status_code=201)
def create_group(
    body: CreateGroupBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group_id = gen_cuid()
    group = models.Group(
        id=group_id, name=body.name, currency=body.currency,
        inviteCode=gen_invite_code(), createdAt=datetime.utcnow(), updatedAt=datetime.utcnow(),
    )
    db.add(group)

    member = models.Member(
        id=gen_cuid(), name=user.name or user.username,
        email=user.email, groupId=group_id, userId=user.id,
        createdAt=datetime.utcnow(),
    )
    db.add(member)
    log_activity(db, group_id, "GROUP_CREATED", {"groupName": body.name, "createdBy": user.name or user.username})
    db.commit()
    db.refresh(group)

    return {
        "id": group.id, "name": group.name, "currency": group.currency,
        "inviteCode": group.inviteCode, "createdAt": group.createdAt.isoformat(),
        "members": [{"id": member.id, "name": member.name}],
        "_count": {"members": 1, "expenses": 0},
    }


@router.get("/api/groups/{group_id}")
def get_group(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")

    members = db.query(models.Member).filter(models.Member.groupId == group_id).order_by(models.Member.createdAt).all()
    expenses = db.query(models.Expense).filter(models.Expense.groupId == group_id).order_by(models.Expense.date.desc()).all()
    settlements = db.query(models.Settlement).filter(models.Settlement.groupId == group_id).order_by(models.Settlement.createdAt.desc()).all()

    member_map = {m.id: {"id": m.id, "name": m.name, "email": m.email} for m in members}

    expenses_out = []
    for e in expenses:
        splits = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expenseId == e.id).all()
        expenses_out.append({
            "id": e.id, "title": e.title, "amountPaise": e.amountPaise,
            "date": e.date.isoformat(), "category": e.category,
            "notes": e.notes, "splitType": e.splitType,
            "isRecurring": e.isRecurring, "recurringPeriod": e.recurringPeriod,
            "paidBy": member_map.get(e.paidById, {}),
            "paidById": e.paidById,
            "splits": [
                {
                    "memberId": s.memberId, "amountPaise": s.amountPaise,
                    "percentage": s.percentage,
                    "member": member_map.get(s.memberId, {}),
                } for s in splits
            ],
        })

    settlements_out = [
        {
            "id": s.id, "amountPaise": s.amountPaise, "note": s.note,
            "createdAt": s.createdAt.isoformat(),
            "fromMember": member_map.get(s.fromMemberId, {}),
            "toMember": member_map.get(s.toMemberId, {}),
        } for s in settlements
    ]

    return {
        "id": group.id, "name": group.name, "currency": group.currency,
        "inviteCode": group.inviteCode, "createdAt": group.createdAt.isoformat(),
        "members": list(member_map.values()),
        "expenses": expenses_out,
        "settlements": settlements_out,
        "_count": {"members": len(members), "expenses": len(expenses)},
    }


@router.patch("/api/groups/{group_id}")
def update_group(
    group_id: str,
    body: UpdateGroupBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")
    if body.name:
        group.name = body.name
    if body.currency:
        group.currency = body.currency
    group.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "currency": group.currency}


# ─── Members ─────────────────────────────────────────────────────────────────

@router.get("/api/groups/{group_id}/members")
def list_members(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    members = db.query(models.Member).filter(models.Member.groupId == group_id).order_by(models.Member.createdAt).all()
    return [{"id": m.id, "name": m.name, "email": m.email, "userId": m.userId} for m in members]


# ─── Expenses ────────────────────────────────────────────────────────────────

class SplitItem(BaseModel):
    memberId: str
    amountPaise: Optional[int] = None
    percentage: Optional[float] = None
    amountInr: Optional[float] = None


class CreateExpenseBody(BaseModel):
    title: str
    amountInr: float
    paidById: str
    date: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    splitType: str
    isRecurring: bool = False
    recurringPeriod: Optional[str] = None
    receiptUrl: Optional[str] = None
    split: dict  # flexible — matches frontend's split object


@router.get("/api/groups/{group_id}/expenses")
def list_expenses(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    expenses = db.query(models.Expense).filter(models.Expense.groupId == group_id).order_by(models.Expense.date.desc()).all()
    members = {m.id: {"id": m.id, "name": m.name} for m in db.query(models.Member).filter(models.Member.groupId == group_id).all()}
    result = []
    for e in expenses:
        splits = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expenseId == e.id).all()
        result.append({
            "id": e.id, "title": e.title, "amountPaise": e.amountPaise,
            "date": e.date.isoformat(), "category": e.category,
            "splitType": e.splitType, "isRecurring": e.isRecurring,
            "paidBy": members.get(e.paidById, {}),
            "paidById": e.paidById,
            "splits": [{"memberId": s.memberId, "amountPaise": s.amountPaise, "percentage": s.percentage, "member": members.get(s.memberId, {})} for s in splits],
        })
    return result


def _calc_splits(split_type: str, split_data: dict, total_paise: int, member_ids_valid: set) -> list:
    """Returns list of {memberId, amountPaise, percentage}"""
    t = split_data.get("type")
    if t == "EQUAL":
        ids = split_data["memberIds"]
        n = len(ids)
        base = total_paise // n
        remainder = total_paise % n
        splits = []
        for i, mid in enumerate(ids):
            splits.append({"memberId": mid, "amountPaise": base + (1 if i < remainder else 0), "percentage": None})
        return splits
    elif t == "PERCENTAGE":
        splits = []
        for s in split_data["splits"]:
            amt = round(total_paise * s["percentage"] / 100)
            splits.append({"memberId": s["memberId"], "amountPaise": amt, "percentage": s["percentage"]})
        return splits
    elif t == "EXACT":
        return [{"memberId": s["memberId"], "amountPaise": to_paise(s["amountInr"]), "percentage": None} for s in split_data["splits"]]
    return []


@router.post("/api/groups/{group_id}/expenses", status_code=201)
def create_expense(
    group_id: str,
    body: CreateExpenseBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    total_paise = to_paise(body.amountInr)

    payer = db.query(models.Member).filter(models.Member.id == body.paidById, models.Member.groupId == group_id).first()
    if not payer:
        raise HTTPException(400, "Payer is not a member of this group")

    all_member_ids = {m.id for m in db.query(models.Member).filter(models.Member.groupId == group_id).all()}
    splits_data = _calc_splits(body.splitType, body.split, total_paise, all_member_ids)

    expense_date = datetime.utcnow()
    if body.date:
        try:
            expense_date = datetime.fromisoformat(body.date.replace("Z", "+00:00").replace("+00:00", ""))
        except Exception:
            pass

    expense = models.Expense(
        id=gen_cuid(), title=body.title, amountPaise=total_paise,
        paidById=body.paidById, groupId=group_id, date=expense_date,
        category=body.category, notes=body.notes, splitType=body.splitType,
        isRecurring=body.isRecurring, recurringPeriod=body.recurringPeriod,
        receiptUrl=body.receiptUrl, createdAt=datetime.utcnow(), updatedAt=datetime.utcnow(),
    )
    db.add(expense)
    db.flush()

    for s in splits_data:
        db.add(models.ExpenseSplit(
            id=gen_cuid(), expenseId=expense.id,
            memberId=s["memberId"], amountPaise=s["amountPaise"], percentage=s["percentage"],
        ))

    log_activity(db, group_id, "EXPENSE_ADDED", {"title": body.title, "amountPaise": total_paise, "addedBy": user.name or user.username})
    db.commit()
    db.refresh(expense)
    return {"id": expense.id, "title": expense.title, "amountPaise": expense.amountPaise}


@router.delete("/api/groups/{group_id}/expenses/{expense_id}", status_code=204)
def delete_expense(
    group_id: str,
    expense_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id, models.Expense.groupId == group_id).first()
    if not expense:
        raise HTTPException(404, "Expense not found")
    title = expense.title
    db.delete(expense)
    log_activity(db, group_id, "EXPENSE_DELETED", {"title": title, "deletedBy": user.name or user.username})
    db.commit()
    return None


# ─── Balances ────────────────────────────────────────────────────────────────

@router.get("/api/groups/{group_id}/balances")
def get_balances(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    members = db.query(models.Member).filter(models.Member.groupId == group_id).order_by(models.Member.createdAt).all()
    expenses = db.query(models.Expense).filter(models.Expense.groupId == group_id).all()
    settlements = db.query(models.Settlement).filter(models.Settlement.groupId == group_id).all()

    member_inputs = [{"memberId": m.id, "memberName": m.name} for m in members]
    expense_inputs = []
    for e in expenses:
        splits = db.query(models.ExpenseSplit).filter(models.ExpenseSplit.expenseId == e.id).all()
        expense_inputs.append({
            "paidById": e.paidById,
            "amountPaise": e.amountPaise,
            "splits": [{"memberId": s.memberId, "amountPaise": s.amountPaise} for s in splits],
        })
    settlement_inputs = [{"fromMemberId": s.fromMemberId, "toMemberId": s.toMemberId, "amountPaise": s.amountPaise} for s in settlements]

    balances = calculate_balances(member_inputs, expense_inputs, settlement_inputs)
    suggestions = minimize_settlements(balances)

    return {
        "balances": [
            {"memberId": b.memberId, "memberName": b.memberName,
             "totalPaidPaise": b.totalPaidPaise, "totalOwedPaise": b.totalOwedPaise,
             "netBalancePaise": b.netBalancePaise} for b in balances
        ],
        "suggestions": [
            {"fromMemberId": s.fromMemberId, "fromMemberName": s.fromMemberName,
             "toMemberId": s.toMemberId, "toMemberName": s.toMemberName,
             "amountPaise": s.amountPaise} for s in suggestions
        ],
    }


# ─── Settlements ─────────────────────────────────────────────────────────────

class CreateSettlementBody(BaseModel):
    fromMemberId: str
    toMemberId: str
    amountPaise: int
    note: Optional[str] = None


@router.get("/api/groups/{group_id}/settlements")
def list_settlements(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    settlements = db.query(models.Settlement).filter(models.Settlement.groupId == group_id).order_by(models.Settlement.createdAt.desc()).all()
    members = {m.id: {"id": m.id, "name": m.name} for m in db.query(models.Member).filter(models.Member.groupId == group_id).all()}
    return [
        {
            "id": s.id, "amountPaise": s.amountPaise, "note": s.note,
            "createdAt": s.createdAt.isoformat(),
            "fromMember": members.get(s.fromMemberId, {}),
            "toMember": members.get(s.toMemberId, {}),
        } for s in settlements
    ]


@router.post("/api/groups/{group_id}/settlements", status_code=201)
def create_settlement(
    group_id: str,
    body: CreateSettlementBody,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    settlement = models.Settlement(
        id=gen_cuid(), groupId=group_id,
        fromMemberId=body.fromMemberId, toMemberId=body.toMemberId,
        amountPaise=body.amountPaise, note=body.note,
        createdAt=datetime.utcnow(),
    )
    db.add(settlement)
    from_m = db.query(models.Member).filter(models.Member.id == body.fromMemberId).first()
    to_m = db.query(models.Member).filter(models.Member.id == body.toMemberId).first()
    log_activity(db, group_id, "SETTLEMENT_RECORDED", {
        "from": from_m.name if from_m else body.fromMemberId,
        "to": to_m.name if to_m else body.toMemberId,
        "amountPaise": body.amountPaise,
    })
    db.commit()
    db.refresh(settlement)
    return {"id": settlement.id, "amountPaise": settlement.amountPaise}


# ─── Activity ────────────────────────────────────────────────────────────────

@router.get("/api/groups/{group_id}/activity")
def get_activity(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    activities = db.query(models.Activity).filter(models.Activity.groupId == group_id).order_by(models.Activity.createdAt.desc()).limit(100).all()
    return [
        {"id": a.id, "type": a.type, "data": json.loads(a.data), "createdAt": a.createdAt.isoformat()}
        for a in activities
    ]


# ─── Export ──────────────────────────────────────────────────────────────────

@router.get("/api/groups/{group_id}/export")
def export_group(
    group_id: str,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_group_member(group_id, user, db)
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")

    members = db.query(models.Member).filter(models.Member.groupId == group_id).all()
    expenses = db.query(models.Expense).filter(models.Expense.groupId == group_id).order_by(models.Expense.date).all()
    settlements = db.query(models.Settlement).filter(models.Settlement.groupId == group_id).all()
    member_map = {m.id: m.name for m in members}

    rows = [["Date", "Title", "Category", "Amount (INR)", "Paid By", "Split Type"]]
    for e in expenses:
        rows.append([
            e.date.strftime("%Y-%m-%d"), e.title, e.category or "",
            f"{e.amountPaise / 100:.2f}", member_map.get(e.paidById, ""), e.splitType,
        ])

    import csv, io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(rows)
    csv_content = output.getvalue()

    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{group.name}.csv"'},
    )
