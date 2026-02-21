from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from dashboard.auth import is_session_valid, set_session_cookie, verify_credentials

router = APIRouter()
templates = Jinja2Templates(directory="dashboard/templates")


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request, "error": None})


@router.post("/login", response_class=HTMLResponse)
def login_submit(request: Request, username: str = Form(...), password: str = Form(...)):
    if not verify_credentials(username, password):
        return templates.TemplateResponse("login.html", {"request": request, "error": "Invalid credentials"}, status_code=401)
    response = RedirectResponse(url="/calls", status_code=status.HTTP_303_SEE_OTHER)
    set_session_cookie(response)
    return response


@router.get("/calls", response_class=HTMLResponse)
def calls_page(request: Request):
    if not is_session_valid(request.cookies.get("dashboard_session")):
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse("calls.html", {"request": request})


@router.get("/calls/{call_id}", response_class=HTMLResponse)
def call_detail_page(call_id: str, request: Request):
    if not is_session_valid(request.cookies.get("dashboard_session")):
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse("call_detail.html", {"request": request, "call_id": call_id})
