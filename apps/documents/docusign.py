"""apps/documents/docusign.py

DocuSign eSignature integration using JWT (server-to-server) authentication.

Flow for option grants:
1. PDF is generated via pdf.py
2. create_signing_envelope() uploads the PDF to DocuSign and creates an envelope
3. The grantee receives an email with a signing link
4. DocuSign calls our webhook (handle_webhook()) on completion
5. We update the Document record status to "signed"

Environment variables needed:
    DOCUSIGN_INTEGRATION_KEY   (OAuth Client ID)
    DOCUSIGN_ACCOUNT_ID
    DOCUSIGN_USER_ID
    DOCUSIGN_PRIVATE_KEY_PATH  (path to RSA private key .pem file)
    DOCUSIGN_BASE_URL          (https://demo.docusign.net/restapi in sandbox)
    DOCUSIGN_WEBHOOK_SECRET
"""
from __future__ import annotations
import base64
import hashlib
import hmac
import logging
from typing import Optional

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_docusign_config():
    return settings.DOCUSIGN


def _authenticate() -> str:
    """
    Obtain a DocuSign access token via JWT Grant (server-to-server).
    In production, cache the token and refresh 5 minutes before expiry.
    """
    import jwt
    import time
    import requests

    cfg = _get_docusign_config()
    if not cfg.get("INTEGRATION_KEY"):
        raise ValueError("DocuSign is not configured — set DOCUSIGN_* environment variables.")

    # Read private key
    try:
        with open(cfg["PRIVATE_KEY_PATH"], "r") as f:
            private_key = f.read()
    except FileNotFoundError:
        raise ValueError(f"DocuSign private key not found at {cfg['PRIVATE_KEY_PATH']}")

    payload = {
        "iss": cfg["INTEGRATION_KEY"],
        "sub": cfg["USER_ID"],
        "aud": "account-d.docusign.com",  # use "account.docusign.com" for production
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
        "scope": "signature impersonation",
    }

    assertion = jwt.encode(payload, private_key, algorithm="RS256")

    resp = requests.post(
        "https://account-d.docusign.com/oauth/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def create_signing_envelope(
    document: "apps.documents.models.Document",
    pdf_bytes: bytes,
    signers: list[dict],
    subject: str = "Please sign your equity document",
    email_blurb: str = "",
) -> str:
    """
    Upload a PDF to DocuSign and create a signing envelope.
    Returns the DocuSign envelope_id.

    `signers` is a list of:
        [{"name": "Alice Chen", "email": "alice@example.com", "routing_order": 1}, ...]
    """
    import requests

    cfg = _get_docusign_config()
    if not cfg.get("INTEGRATION_KEY"):
        logger.warning("DocuSign not configured — skipping envelope creation.")
        return ""

    try:
        access_token = _authenticate()
    except Exception as e:
        logger.error(f"DocuSign auth failed: {e}")
        raise

    doc_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
    filename = f"{document.doc_type}_{document.id}.pdf"

    # Build signer tabs — auto-place signature and date fields at the bottom of page 1
    recipients = []
    for i, signer in enumerate(signers):
        recipients.append({
            "email": signer["email"],
            "name": signer["name"],
            "recipientId": str(i + 1),
            "routingOrder": signer.get("routing_order", i + 1),
            "tabs": {
                "signHereTabs": [{
                    "documentId": "1",
                    "pageNumber": "1",
                    "xPosition": "100",
                    "yPosition": "650",
                    "tabLabel": "Sign Here",
                }],
                "dateSignedTabs": [{
                    "documentId": "1",
                    "pageNumber": "1",
                    "xPosition": "300",
                    "yPosition": "650",
                    "tabLabel": "Date Signed",
                }],
            },
        })

    envelope_def = {
        "emailSubject": subject,
        "emailBlurb": email_blurb or f"Please review and sign your {document.get_doc_type_display()} document.",
        "documents": [{
            "documentBase64": doc_b64,
            "name": document.title,
            "fileExtension": "pdf",
            "documentId": "1",
        }],
        "recipients": {"signers": recipients},
        "status": "sent",  # "created" = draft, "sent" = immediately dispatched
        "eventNotification": {
            "url": f"{cfg.get('WEBHOOK_CALLBACK_URL', '')}/api/v1/documents/docusign/webhook/",
            "loggingEnabled": True,
            "requireAcknowledgment": True,
            "envelopeEvents": [
                {"envelopeEventStatusCode": "completed"},
                {"envelopeEventStatusCode": "declined"},
                {"envelopeEventStatusCode": "voided"},
            ],
        },
    }

    resp = requests.post(
        f"{cfg['BASE_URL']}/v2.1/accounts/{cfg['ACCOUNT_ID']}/envelopes",
        json=envelope_def,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=30,
    )
    resp.raise_for_status()
    envelope_id = resp.json()["envelopeId"]

    # Update document record
    document.docusign_envelope_id = envelope_id
    document.docusign_status = "sent"
    document.status = "pending_signature"
    document.sent_at = timezone.now()
    document.save(update_fields=["docusign_envelope_id", "docusign_status", "status", "sent_at", "updated_at"])

    logger.info(f"DocuSign envelope {envelope_id} created for document {document.id}")
    return envelope_id


def verify_webhook_signature(request_body: bytes, header_signature: str) -> bool:
    """
    Verify the HMAC-SHA256 signature on an incoming DocuSign webhook payload.
    DocuSign sends: X-DocuSign-Signature-1: <base64-encoded HMAC>
    """
    secret = _get_docusign_config().get("WEBHOOK_SECRET", "")
    if not secret:
        logger.warning("DOCUSIGN_WEBHOOK_SECRET not set — skipping signature verification (INSECURE).")
        return True  # Don't block in dev, but log the warning

    expected = base64.b64encode(
        hmac.new(secret.encode(), request_body, hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, header_signature or "")


def handle_webhook(payload: dict) -> None:
    """
    Process a DocuSign Connect webhook event.
    Called by DocumentWebhookView after signature verification.
    """
    from apps.documents.models import Document, Signature

    envelope_id = payload.get("envelopeId") or payload.get("data", {}).get("envelopeId")
    status = (payload.get("status") or payload.get("data", {}).get("envelopeSummary", {}).get("status", "")).lower()

    if not envelope_id:
        logger.warning(f"DocuSign webhook missing envelopeId: {payload}")
        return

    try:
        document = Document.objects.get(docusign_envelope_id=envelope_id)
    except Document.DoesNotExist:
        logger.warning(f"No document found for DocuSign envelope {envelope_id}")
        return

    document.docusign_status = status
    now = timezone.now()

    if status == "completed":
        document.status = "signed"
        document.signed_at = now
        document.save(update_fields=["docusign_status", "status", "signed_at", "updated_at"])
        logger.info(f"Document {document.id} signed via DocuSign envelope {envelope_id}")

        # Update linked Security compliance state if it's a grant letter
        if document.security and document.doc_type == "option_grant_letter":
            sec = document.security
            # Mark as board-approved if this was the grant letter
            if not sec.board_approval_date:
                from datetime import date
                sec.board_approval_date = date.today()
                sec.save(update_fields=["board_approval_date", "updated_at"])

    elif status == "declined":
        document.status = "voided"
        document.voided_at = now
        document.save(update_fields=["docusign_status", "status", "voided_at", "updated_at"])
        logger.warning(f"Document {document.id} declined by signer via envelope {envelope_id}")

    elif status == "voided":
        document.status = "voided"
        document.voided_at = now
        document.save(update_fields=["docusign_status", "status", "voided_at", "updated_at"])

    # Update recipient signature records
    recipients = (payload.get("recipients") or
                  payload.get("data", {}).get("envelopeSummary", {}).get("recipients", {}))
    if recipients and isinstance(recipients, dict):
        for signer in recipients.get("signers", []):
            sig_status = signer.get("status", "").lower()
            try:
                sig = Signature.objects.get(
                    document=document,
                    docusign_recipient_id=signer.get("recipientId", ""),
                )
                if sig_status == "completed":
                    sig.signed_at = now
                    sig.save(update_fields=["signed_at"])
                elif sig_status == "declined":
                    sig.declined_at = now
                    sig.save(update_fields=["declined_at"])
            except Signature.DoesNotExist:
                pass
