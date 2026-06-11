"""apps/documents/views.py"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.shortcuts import get_object_or_404

from .models import Document, Signature
from .serializers import DocumentSerializer, SignatureSerializer
from .docusign import verify_webhook_signature, handle_webhook
from apps.equity.permissions import IsCompanyMember

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]
    filterset_fields = ["doc_type", "status"]

    def get_queryset(self):
        return Document.objects.filter(company_id=self.kwargs["company_pk"])

    @action(detail=False, methods=["post"])
    def generate_certificate(self, request, company_pk=None):
        """
        Generate a stock certificate PDF for a given security.
        Body: {"security_id": "<uuid>"}
        The PDF is generated asynchronously via Celery.
        """
        from apps.equity.models import Security, Company
        from .tasks import generate_and_store_certificate

        security_id = request.data.get("security_id")
        if not security_id:
            return Response({"error": "security_id is required."}, status=400)

        security = get_object_or_404(Security, id=security_id, company_id=company_pk)

        doc = Document.objects.create(
            company_id=company_pk,
            doc_type="stock_certificate",
            title=f"Stock Certificate — {security.stakeholder.name} ({security.certificate_number})",
            security=security,
            created_by=request.user,
            status="draft",
        )

        # Dispatch async PDF generation task
        generate_and_store_certificate.delay(str(doc.id))

        return Response(DocumentSerializer(doc).data, status=201)

    @action(detail=False, methods=["post"])
    def generate_grant_letter(self, request, company_pk=None):
        """
        Generate an option grant letter PDF and optionally send via DocuSign.
        Body: {"security_id": "<uuid>", "send_for_signature": true}
        """
        from apps.equity.models import Security
        from .tasks import generate_and_send_grant_letter

        security_id = request.data.get("security_id")
        send_for_sig = request.data.get("send_for_signature", False)

        if not security_id:
            return Response({"error": "security_id is required."}, status=400)

        security = get_object_or_404(Security, id=security_id, company_id=company_pk)

        if security.share_class.cls_type not in ("option", "warrant"):
            return Response({"error": "Grant letters are for options and warrants only."}, status=400)

        doc = Document.objects.create(
            company_id=company_pk,
            doc_type="option_grant_letter",
            title=f"Option Grant Letter — {security.stakeholder.name} ({security.certificate_number})",
            security=security,
            created_by=request.user,
            status="draft",
        )

        generate_and_send_grant_letter.delay(str(doc.id), send_for_sig)
        return Response(DocumentSerializer(doc).data, status=201)

    @action(detail=True, methods=["post"])
    def send_for_signature(self, request, company_pk=None, pk=None):
        """Send an existing (generated) document to DocuSign for signing."""
        from .tasks import send_document_for_signature

        doc = self.get_object()
        if not doc.file:
            return Response({"error": "Document has not been generated yet."}, status=400)
        if doc.status not in ("draft", "signed"):
            return Response({"error": f"Document is already in status '{doc.status}'."}, status=400)

        send_document_for_signature.delay(str(doc.id))
        return Response({"status": "queued", "document_id": str(doc.id)})

    @action(detail=True, methods=["get"])
    def download(self, request, company_pk=None, pk=None):
        """Return a pre-signed S3 URL (or direct URL) for the document."""
        doc = self.get_object()
        if not doc.file:
            return Response({"error": "No file available yet."}, status=404)

        try:
            url = doc.file.url
        except Exception:
            url = None

        return Response({"url": url, "filename": doc.title + ".pdf"})


@method_decorator(csrf_exempt, name="dispatch")
class DocuSignWebhookView(APIView):
    """
    Receives DocuSign Connect webhook callbacks.
    Verifies HMAC signature and updates document status.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        sig = request.headers.get("X-DocuSign-Signature-1", "")
        if not verify_webhook_signature(request.body, sig):
            logger.warning("DocuSign webhook: invalid HMAC signature")
            return Response({"error": "Invalid signature"}, status=403)

        try:
            handle_webhook(request.data)
        except Exception as e:
            logger.exception(f"DocuSign webhook handler error: {e}")
            return Response({"error": "Internal error"}, status=500)

        return Response({"status": "ok"})
