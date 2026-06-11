"""apps/documents/tasks.py

Celery tasks for document generation.
These run on the `pdf` queue (dedicated workers) because WeasyPrint
is CPU/memory-intensive and should not block the API workers.
"""
from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(queue="pdf", bind=True, max_retries=3, default_retry_delay=30)
def generate_and_store_certificate(self, document_id: str):
    """
    Generate a stock certificate PDF and store it in S3 (or local media).
    Updates Document.file and Document.status on completion.
    """
    from apps.documents.models import Document
    from apps.documents.pdf import generate_stock_certificate
    from django.core.files.base import ContentFile

    try:
        doc = Document.objects.select_related("security__stakeholder", "security__share_class", "security__vesting_schedule", "company").get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found for certificate generation")
        return

    try:
        pdf_bytes = generate_stock_certificate(doc.security)
        filename = f"certificates/{doc.company_id}/{doc.security.certificate_number}.pdf"
        doc.file.save(filename, ContentFile(pdf_bytes), save=False)
        doc.file_size = len(pdf_bytes)
        doc.status = "draft"
        doc.save(update_fields=["file", "file_size", "status", "updated_at"])
        logger.info(f"Certificate generated for {doc.security.certificate_number}: {len(pdf_bytes)} bytes")
    except Exception as exc:
        logger.exception(f"Certificate generation failed for document {document_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(queue="pdf", bind=True, max_retries=3, default_retry_delay=30)
def generate_and_send_grant_letter(self, document_id: str, send_for_signature: bool = False):
    """
    Generate an option grant letter PDF.
    Optionally sends it to DocuSign for the grantee's signature.
    """
    from apps.documents.models import Document, Signature
    from apps.documents.pdf import generate_option_grant_letter
    from apps.documents.docusign import create_signing_envelope
    from django.core.files.base import ContentFile

    try:
        doc = Document.objects.select_related(
            "security__stakeholder", "security__share_class",
            "security__vesting_schedule", "security__company",
            "company"
        ).get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found for grant letter generation")
        return

    try:
        pdf_bytes = generate_option_grant_letter(doc.security)
        filename = f"grant_letters/{doc.company_id}/{doc.security.certificate_number}.pdf"
        doc.file.save(filename, ContentFile(pdf_bytes), save=False)
        doc.file_size = len(pdf_bytes)
        doc.status = "draft"
        doc.save(update_fields=["file", "file_size", "status", "updated_at"])
        logger.info(f"Grant letter generated for {doc.security.certificate_number}")
    except Exception as exc:
        logger.exception(f"Grant letter generation failed: {exc}")
        raise self.retry(exc=exc)

    if send_for_signature and doc.security.stakeholder.email:
        send_document_for_signature.apply_async(args=[document_id], countdown=2)


@shared_task(queue="pdf", bind=True, max_retries=3, default_retry_delay=60)
def send_document_for_signature(self, document_id: str):
    """
    Send a generated document to DocuSign for e-signature.
    Creates signer records and dispatches the envelope.
    """
    from apps.documents.models import Document, Signature
    from apps.documents.docusign import create_signing_envelope

    try:
        doc = Document.objects.select_related("security__stakeholder", "company").get(id=document_id)
    except Document.DoesNotExist:
        logger.error(f"Document {document_id} not found for DocuSign dispatch")
        return

    if not doc.file:
        logger.error(f"Document {document_id} has no PDF file — cannot send for signature")
        return

    stakeholder = doc.security.stakeholder if doc.security else None
    if not stakeholder or not stakeholder.email:
        logger.warning(f"Document {document_id} has no stakeholder email — cannot send for signature")
        return

    signers = [{
        "name": stakeholder.name,
        "email": stakeholder.email,
        "routing_order": 1,
    }]

    # Create Signature records
    for signer in signers:
        Signature.objects.get_or_create(
            document=doc,
            email=signer["email"],
            defaults={
                "company": doc.company,
                "name": signer["name"],
                "stakeholder": stakeholder,
                "docusign_recipient_id": str(signers.index(signer) + 1),
            }
        )

    try:
        pdf_bytes = doc.file.read()
        envelope_id = create_signing_envelope(
            document=doc,
            pdf_bytes=pdf_bytes,
            signers=signers,
            subject=f"Please sign: {doc.title} — {doc.company.name}",
        )
        logger.info(f"DocuSign envelope {envelope_id} sent for document {document_id}")
    except Exception as exc:
        logger.exception(f"DocuSign dispatch failed for document {document_id}: {exc}")
        raise self.retry(exc=exc)
