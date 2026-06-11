"""apps/documents/models.py"""
from django.db import models
from apps.core.models import TenantModel


class Document(TenantModel):
    """
    A stored document — stock certificate, grant letter, board consent, etc.
    May have an associated DocuSign envelope for e-signature.
    """
    DOC_TYPES = [
        ("stock_certificate",    "Stock Certificate"),
        ("option_grant_letter",  "Option Grant Letter"),
        ("safe_agreement",       "SAFE Agreement"),
        ("board_consent",        "Board Consent"),
        ("83b_election",         "83(b) Election Form"),
        ("form_3921",            "IRS Form 3921"),
        ("409a_report",          "409A Valuation Report"),
        ("subscription_agreement", "Subscription Agreement"),
    ]
    STATUS_CHOICES = [
        ("draft",      "Draft"),
        ("pending_signature", "Pending Signature"),
        ("signed",     "Signed"),
        ("voided",     "Voided"),
        ("archived",   "Archived"),
    ]

    doc_type     = models.CharField(max_length=40, choices=DOC_TYPES)
    title        = models.CharField(max_length=255)
    status       = models.CharField(max_length=30, choices=STATUS_CHOICES, default="draft")
    security     = models.ForeignKey(
        "equity.Security", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="documents"
    )
    file         = models.FileField(upload_to="documents/%Y/%m/", null=True, blank=True)
    file_size    = models.BigIntegerField(null=True, blank=True)

    # DocuSign
    docusign_envelope_id  = models.CharField(max_length=100, blank=True, db_index=True)
    docusign_status       = models.CharField(max_length=30, blank=True)
    sent_at               = models.DateTimeField(null=True, blank=True)
    signed_at             = models.DateTimeField(null=True, blank=True)
    voided_at             = models.DateTimeField(null=True, blank=True)

    created_by   = models.ForeignKey(
        "accounts.User", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="created_documents"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_doc_type_display()} — {self.title}"


class Signature(TenantModel):
    """Tracks each signer on a DocuSign envelope."""
    document   = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="signatures")
    stakeholder = models.ForeignKey(
        "equity.Stakeholder", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="signatures"
    )
    name       = models.CharField(max_length=255)
    email      = models.EmailField()
    signed_at  = models.DateTimeField(null=True, blank=True)
    declined_at = models.DateTimeField(null=True, blank=True)
    docusign_recipient_id = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} on {self.document}"
