"""apps/equity/urls.py"""
from rest_framework_nested import routers
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet, ShareClassViewSet, StakeholderViewSet,
    SecurityViewSet, ExerciseViewSet, FundingRoundViewSet, ComplianceRecordViewSet,
)

# Top-level router
router = DefaultRouter()
router.register(r"companies", CompanyViewSet, basename="company")

# Nested: /companies/{company_pk}/...
try:
    from rest_framework_nested.routers import NestedDefaultRouter
    company_router = NestedDefaultRouter(router, r"companies", lookup="company")
except ImportError:
    # Fallback: flat routes with company_pk path param
    from rest_framework.routers import DefaultRouter as NestedDefaultRouter
    company_router = DefaultRouter()

company_router.register(r"share-classes",     ShareClassViewSet,     basename="company-shareclass")
company_router.register(r"stakeholders",      StakeholderViewSet,    basename="company-stakeholder")
company_router.register(r"securities",        SecurityViewSet,       basename="company-security")
company_router.register(r"exercises",         ExerciseViewSet,       basename="company-exercise")
company_router.register(r"funding-rounds",    FundingRoundViewSet,   basename="company-funding-round")
company_router.register(r"compliance-log",    ComplianceRecordViewSet, basename="company-compliance")

urlpatterns = router.urls + company_router.urls
