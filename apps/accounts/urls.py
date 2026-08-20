"""apps/accounts/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .lp_api import LPViewSet
from .views import RegisterView, MeView

_lp_router = DefaultRouter()
_lp_router.register(r'lps', LPViewSet, basename='lp')

urlpatterns = [
    path('', include(_lp_router.urls)),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
]
