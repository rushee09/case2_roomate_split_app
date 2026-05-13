"""
Balance calculation engine — Python port of lib/balance.ts
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class MemberBalance:
    memberId: str
    memberName: str
    totalPaidPaise: int = 0
    totalOwedPaise: int = 0
    netBalancePaise: int = 0


@dataclass
class SettlementSuggestion:
    fromMemberId: str
    fromMemberName: str
    toMemberId: str
    toMemberName: str
    amountPaise: int


def calculate_balances(members, expenses, settlements) -> List[MemberBalance]:
    ledger: dict[str, dict] = {m["memberId"]: {"paid": 0, "owed": 0} for m in members}

    for expense in expenses:
        payer = ledger.get(expense["paidById"])
        if payer:
            payer["paid"] += expense["amountPaise"]
        for split in expense["splits"]:
            participant = ledger.get(split["memberId"])
            if participant:
                participant["owed"] += split["amountPaise"]

    for s in settlements:
        payer = ledger.get(s["fromMemberId"])
        if payer:
            payer["paid"] += s["amountPaise"]
        receiver = ledger.get(s["toMemberId"])
        if receiver:
            receiver["owed"] += s["amountPaise"]

    result = []
    for m in members:
        entry = ledger.get(m["memberId"], {"paid": 0, "owed": 0})
        result.append(MemberBalance(
            memberId=m["memberId"],
            memberName=m["memberName"],
            totalPaidPaise=entry["paid"],
            totalOwedPaise=entry["owed"],
            netBalancePaise=entry["paid"] - entry["owed"],
        ))
    return result


def minimize_settlements(balances: List[MemberBalance]) -> List[SettlementSuggestion]:
    creditors = [(b.memberId, b.memberName, b.netBalancePaise)
                 for b in balances if b.netBalancePaise > 0]
    debtors = [(b.memberId, b.memberName, abs(b.netBalancePaise))
               for b in balances if b.netBalancePaise < 0]

    creditors = sorted(creditors, key=lambda x: x[2], reverse=True)
    debtors = sorted(debtors, key=lambda x: x[2], reverse=True)

    # Convert to mutable lists
    cred = [[mid, name, amt] for mid, name, amt in creditors]
    debt = [[mid, name, amt] for mid, name, amt in debtors]

    suggestions = []
    i, j = 0, 0
    while i < len(cred) and j < len(debt):
        amount = min(cred[i][2], debt[j][2])
        if amount > 0:
            suggestions.append(SettlementSuggestion(
                fromMemberId=debt[j][0],
                fromMemberName=debt[j][1],
                toMemberId=cred[i][0],
                toMemberName=cred[i][1],
                amountPaise=amount,
            ))
        cred[i][2] -= amount
        debt[j][2] -= amount
        if cred[i][2] < 1:
            i += 1
        if debt[j][2] < 1:
            j += 1

    return suggestions
