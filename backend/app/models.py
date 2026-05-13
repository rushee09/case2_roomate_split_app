"""
SQLAlchemy models matching the Prisma schema exactly.
Table names and column names mirror what Prisma creates in SQLite.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "User"

    id = Column("id", String, primary_key=True)
    name = Column("name", String, nullable=True)
    username = Column("username", String, unique=True, nullable=False)
    email = Column("email", String, unique=True, nullable=False)
    emailVerified = Column("emailVerified", DateTime, nullable=True)
    image = Column("image", String, nullable=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)

    members = relationship("Member", back_populates="user")
    sentInvitations = relationship("GroupInvitation", foreign_keys="GroupInvitation.invitedById", back_populates="invitedBy")
    receivedInvitations = relationship("GroupInvitation", foreign_keys="GroupInvitation.invitedUserId", back_populates="invitedUser")


class Group(Base):
    __tablename__ = "Group"

    id = Column("id", String, primary_key=True)
    name = Column("name", String, nullable=False)
    currency = Column("currency", String, default="INR")
    inviteCode = Column("inviteCode", String, unique=True, nullable=False)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
    updatedAt = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("Member", back_populates="group", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="group", cascade="all, delete-orphan")
    settlements = relationship("Settlement", back_populates="group", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="group", cascade="all, delete-orphan")
    invitations = relationship("GroupInvitation", back_populates="group", cascade="all, delete-orphan")


class Member(Base):
    __tablename__ = "Member"

    id = Column("id", String, primary_key=True)
    name = Column("name", String, nullable=False)
    email = Column("email", String, nullable=True)
    groupId = Column("groupId", String, ForeignKey("Group.id", ondelete="CASCADE"), nullable=False)
    userId = Column("userId", String, ForeignKey("User.id"), nullable=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("userId", "groupId", name="Member_userId_groupId_key"),)

    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="members")
    paidExpenses = relationship("Expense", foreign_keys="Expense.paidById", back_populates="paidBy")
    expenseSplits = relationship("ExpenseSplit", back_populates="member")
    settlementsFrom = relationship("Settlement", foreign_keys="Settlement.fromMemberId", back_populates="fromMember")
    settlementsTo = relationship("Settlement", foreign_keys="Settlement.toMemberId", back_populates="toMember")


class Expense(Base):
    __tablename__ = "Expense"

    id = Column("id", String, primary_key=True)
    title = Column("title", String, nullable=False)
    amountPaise = Column("amountPaise", Integer, nullable=False)
    paidById = Column("paidById", String, ForeignKey("Member.id"), nullable=False)
    groupId = Column("groupId", String, ForeignKey("Group.id", ondelete="CASCADE"), nullable=False)
    date = Column("date", DateTime, default=datetime.utcnow)
    category = Column("category", String, nullable=True)
    notes = Column("notes", String, nullable=True)
    splitType = Column("splitType", String, nullable=False)
    isRecurring = Column("isRecurring", Boolean, default=False)
    recurringPeriod = Column("recurringPeriod", String, nullable=True)
    receiptUrl = Column("receiptUrl", String, nullable=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)
    updatedAt = Column("updatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("Group", back_populates="expenses")
    paidBy = relationship("Member", foreign_keys=[paidById], back_populates="paidExpenses")
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")


class ExpenseSplit(Base):
    __tablename__ = "ExpenseSplit"

    id = Column("id", String, primary_key=True)
    expenseId = Column("expenseId", String, ForeignKey("Expense.id", ondelete="CASCADE"), nullable=False)
    memberId = Column("memberId", String, ForeignKey("Member.id"), nullable=False)
    amountPaise = Column("amountPaise", Integer, nullable=False)
    percentage = Column("percentage", Float, nullable=True)

    __table_args__ = (UniqueConstraint("expenseId", "memberId", name="ExpenseSplit_expenseId_memberId_key"),)

    expense = relationship("Expense", back_populates="splits")
    member = relationship("Member", back_populates="expenseSplits")


class Settlement(Base):
    __tablename__ = "Settlement"

    id = Column("id", String, primary_key=True)
    groupId = Column("groupId", String, ForeignKey("Group.id", ondelete="CASCADE"), nullable=False)
    fromMemberId = Column("fromMemberId", String, ForeignKey("Member.id"), nullable=False)
    toMemberId = Column("toMemberId", String, ForeignKey("Member.id"), nullable=False)
    amountPaise = Column("amountPaise", Integer, nullable=False)
    note = Column("note", String, nullable=True)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="settlements")
    fromMember = relationship("Member", foreign_keys=[fromMemberId], back_populates="settlementsFrom")
    toMember = relationship("Member", foreign_keys=[toMemberId], back_populates="settlementsTo")


class Activity(Base):
    __tablename__ = "Activity"

    id = Column("id", String, primary_key=True)
    groupId = Column("groupId", String, ForeignKey("Group.id", ondelete="CASCADE"), nullable=False)
    type = Column("type", String, nullable=False)
    data = Column("data", Text, nullable=False)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="activities")


class GroupInvitation(Base):
    __tablename__ = "GroupInvitation"

    id = Column("id", String, primary_key=True)
    groupId = Column("groupId", String, ForeignKey("Group.id", ondelete="CASCADE"), nullable=False)
    invitedById = Column("invitedById", String, ForeignKey("User.id"), nullable=False)
    invitedEmail = Column("invitedEmail", String, nullable=False)
    invitedUserId = Column("invitedUserId", String, ForeignKey("User.id"), nullable=True)
    token = Column("token", String, unique=True, nullable=False)
    status = Column("status", String, default="PENDING")
    expiresAt = Column("expiresAt", DateTime, nullable=False)
    createdAt = Column("createdAt", DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="invitations")
    invitedBy = relationship("User", foreign_keys=[invitedById], back_populates="sentInvitations")
    invitedUser = relationship("User", foreign_keys=[invitedUserId], back_populates="receivedInvitations")
