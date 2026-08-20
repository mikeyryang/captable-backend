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


import uuid as _uuid
from django.db import models as _models

class Cashflow(_models.Model):
    """A dated fund-level cashflow: capital call or distribution."""
    TYPES = [("call","Capital Call"),("dist","Distribution")]
    id     = _models.UUIDField(primary_key=True, default=_uuid.uuid4, editable=False)
    fund   = _models.ForeignKey("equity.Fund", on_delete=_models.CASCADE, related_name="cashflows", null=True, blank=True)
    type   = _models.CharField(max_length=8, choices=TYPES)
    label  = _models.CharField(max_length=255, blank=True)
    amount_cents = _models.BigIntegerField(default=0, help_text="Positive cents; sign by type")
    date   = _models.DateField()
    created_at = _models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]

    @property
    def amount(self):
        return self.amount_cents / 100
