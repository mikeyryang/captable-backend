"""captable/urls.py"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # ── Auth ──────────────────────────────────────────────────
    path("api/auth/token/",         TokenObtainPairView.as_view(),  name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(),     name="token_refresh"),
    path("api/auth/token/verify/",  TokenVerifyView.as_view(),      name="token_verify"),

    # ── API v1 ────────────────────────────────────────────────
    path("api/v1/accounts/",   include("apps.accounts.urls")),
    path("api/v1/equity/",     include("apps.equity.urls")),
    path("api/v1/documents/",  include("apps.documents.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
