"""apps/core/models.py

Abstract base models used across all apps.
The TenantModel pattern enforces company-scoped data isolation — every
equity record is scoped to a single Company row, and the custom manager
automatically filters by the requesting company to prevent cross-tenant leaks.
"""
import uuid
from django.db import models


class UUIDModel(models.Model):
    """Primary key is a UUID — never expose sequential integer IDs for financial records."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(UUIDModel):
    """Audit timestamps on every record."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantModel(TimeStampedModel):
    """
    All equity/document records belong to a Company (tenant).
    The TenantManager filters by company_id automatically when used with
    request.company (set by CompanyMiddleware from the JWT claim).

    IMPORTANT: Never query equity models without scoping to a company.
    Use Model.objects.for_company(company_id) everywhere.
    """
    company = models.ForeignKey(
        "equity.Company",
        on_delete=models.CASCADE,
        related_name="+",
        db_index=True,
    )

    class Meta:
        abstract = True
