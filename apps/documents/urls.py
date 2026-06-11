"""apps/documents/urls.py"""
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DocumentViewSet, DocuSignWebhookView

router = DefaultRouter()
router.register(r"companies/(?P<company_pk>[^/.]+)/documents", DocumentViewSet, basename="company-document")

urlpatterns = router.urls + [
    path("docusign/webhook/", DocuSignWebhookView.as_view(), name="docusign_webhook"),
]
