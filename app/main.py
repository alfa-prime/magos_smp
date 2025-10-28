from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core import get_settings, init_gateway_client, shutdown_gateway_client
from app.route import router as api_router

settings = get_settings()
tags_metadata = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_gateway_client(app)
    yield
    await shutdown_gateway_client(app)


app = FastAPI(
    openapi_tags=tags_metadata,
    title="АПИ для браузерного расширения ЕВМИАС -> ОМС",
    description="[CМП] АПИ для сбора данных из ЕВМИАС и заполнения формы ГИС ОМС. {gateway version}",
    lifespan=lifespan,
    version="0.1.0"
)

instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,  # noqa
    allow_origin_regex=settings.CORS_ALLOW_REGEX,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Разрешить все методы (GET, POST, и т.д.)
    allow_headers=["*"],  # Разрешить все заголовки
)

app.include_router(api_router)
