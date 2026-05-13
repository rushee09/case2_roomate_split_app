from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv("../.env")

from app.routers import groups, users, invitations, join

app = FastAPI(title="Pocket API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups.router)
app.include_router(users.router)
app.include_router(invitations.router)
app.include_router(join.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Pocket FastAPI"}
