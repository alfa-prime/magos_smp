from fastapi import APIRouter

from .extension import router as extension_router
from .health import router as health_router

router = APIRouter()
router.include_router(health_router)
router.include_router(extension_router)
