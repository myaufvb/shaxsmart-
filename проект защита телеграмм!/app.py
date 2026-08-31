import os
import datetime
import hashlib
from fastapi import FastAPI, Request, Response, Form, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from models import (
    init_db, SessionLocal, User, PendingAuth,
    TelegramProtectionConfig, WhitelistedSession, normalize_phone
)

# Initialize Database
init_db()

app = FastAPI(title="Telegram Guard Shield")

# Mount Static & Templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

# Helper for current user from cookie
def get_current_user(request: Request, db: Session = Depends(get_db)):
    user_id = request.cookies.get("user_id")
    if not user_id:
        return None
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user
    except Exception:
        return None

# Page Routes
@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request, user: User = Depends(get_current_user)):
    if user:
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    
    config = db.query(TelegramProtectionConfig).filter(TelegramProtectionConfig.user_id == user.id).first()
    if not config:
        config = TelegramProtectionConfig(user_id=user.id, device_limit=2)
        db.add(config)
        db.commit()
        db.refresh(config)

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "user": user,
        "config": config
    })

# API Routes
@app.post("/api/register")
async def register(
    username: str = Form(...),
    country_code: str = Form(...),
    phone_number: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    full_phone = f"{country_code}{phone_number}"
    normalized = normalize_phone(full_phone)

    if not normalized or len(normalized) < 8:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Некорректный номер телефона", "field": "phone_number"}
        )

    # Check if username exists
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Пользователь с таким логином уже существует", "field": "username"}
        )

    # Check if phone number exists
    existing_phone = db.query(User).filter(User.phone_number == normalized).first()
    if existing_phone:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Аккаунт с таким номером телефона уже зарегистрирован", "field": "phone_number"}
        )

    # Create pending authorization
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    pending = PendingAuth(
        phone_number=normalized,
        verify_code="",  # Will be generated when user clicks contact in bot
        is_verified=False,
        expires_at=expires_at
    )
    db.add(pending)
    db.commit()

    return {
        "success": True,
        "bot_url": "https://t.me/Defense_telegram_lerman_bot",
        "phone_number": normalized
    }

@app.post("/api/login")
async def login(
    country_code: str = Form(...),
    phone_number: str = Form(...),
    password: str = Form(...),
    response: Response = None,
    db: Session = Depends(get_db)
):
    full_phone = f"{country_code}{phone_number}"
    normalized = normalize_phone(full_phone)

    user = db.query(User).filter(User.phone_number == normalized).first()
    if not user:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Аккаунт с таким номером телефона не найден", "field": "phone_number"}
        )

    if user.password_hash != hash_password(password):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Неверный пароль", "field": "password"}
        )

    # Login successful
    res = JSONResponse(content={"success": True, "redirect": "/dashboard"})
    res.set_cookie(key="user_id", value=str(user.id), httponly=True, max_age=86400*7)
    return res

@app.post("/api/verify-code")
async def verify_code(
    phone_number: str = Form(...),
    code: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    response: Response = None,
    db: Session = Depends(get_db)
):
    normalized = normalize_phone(phone_number)
    now = datetime.datetime.utcnow()

    pending = db.query(PendingAuth).filter(
        PendingAuth.phone_number == normalized,
        PendingAuth.verify_code == code.strip(),
        PendingAuth.expires_at > now,
        PendingAuth.is_verified == False
    ).first()

    if not pending:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Неверный или просроченный код подтверждения", "field": "code"}
        )

    # Mark verified
    pending.is_verified = True

    # Create new user
    user = User(
        username=username.strip(),
        phone_number=normalized,
        password_hash=hash_password(password),
        is_verified=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default protection config
    config = TelegramProtectionConfig(user_id=user.id, device_limit=2, auto_kill_enabled=True)
    db.add(config)
    db.commit()

    res = JSONResponse(content={"success": True, "redirect": "/dashboard"})
    res.set_cookie(key="user_id", value=str(user.id), httponly=True, max_age=86400*7)
    return res

@app.post("/api/update-device-limit")
async def update_device_limit(
    device_limit: int = Form(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if device_limit < 1 or device_limit > 50:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Лимит устройств должен быть от 1 до 50"}
        )

    config = db.query(TelegramProtectionConfig).filter(TelegramProtectionConfig.user_id == user.id).first()
    if not config:
        config = TelegramProtectionConfig(user_id=user.id, device_limit=device_limit)
        db.add(config)
    else:
        config.device_limit = device_limit
    
    db.commit()
    return {"success": True, "device_limit": device_limit, "message": "Лимит устройств успешно обновлен"}

@app.post("/api/logout")
async def logout(response: Response):
    res = RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    res.delete_cookie("user_id")
    return res
