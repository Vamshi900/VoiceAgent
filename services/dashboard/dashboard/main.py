from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from dashboard.routes import router

app = FastAPI(title="VoiceCall Dashboard")
app.mount("/static", StaticFiles(directory="dashboard/static"), name="static")
app.include_router(router)

templates = Jinja2Templates(directory="dashboard/templates")


@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
