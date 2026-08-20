"""apps/core/urls.py"""
from rest_framework.routers import DefaultRouter
router = DefaultRouter()
from .cashflow_api import CashflowViewSet
router.register(r'cashflows', CashflowViewSet, basename='cashflow')
urlpatterns = router.urls
