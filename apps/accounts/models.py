"""apps/accounts/models.py"""
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class User(AbstractUser):
    """
    Extended user model.
    A user can belong to multiple companies (via CompanyMembership).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email


class CompanyMembership(models.Model):
    """
    Ties a User to a Company with a specific role.
    Roles determine what the user can see and modify in that company's cap table.
    """
    ROLE_CHOICES = [
        ("owner",    "Owner"),          # full admin, can issue and delete securities
        ("admin",    "Admin"),          # can issue, edit, view all
        ("viewer",   "Viewer"),         # read-only: can see cap table
        ("employee", "Employee"),       # can only see their own grants
        ("investor", "Investor"),       # can see their own holdings + company summary
    ]

    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    company = models.ForeignKey("equity.Company", on_delete=models.CASCADE, related_name="memberships")
    role    = models.CharField(max_length=20, choices=ROLE_CHOICES, default="viewer")
    invited_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "company")

    def __str__(self):
        return f"{self.user.email} @ {self.company.name} ({self.role})"


import uuid as _uuid2
from django.db import models as _m

class LP(_m.Model):
    """A limited partner in a fund."""
    TYPES = [("Endowment","Endowment"),("Family Office","Family Office"),
             ("Pension Fund","Pension Fund"),("Individual","Individual"),
             ("Corporate","Corporate"),("Fund of Funds","Fund of Funds")]
    id   = _m.UUIDField(primary_key=True, default=_uuid2.uuid4, editable=False)
    fund = _m.ForeignKey("equity.Fund", on_delete=_m.CASCADE, related_name="lps", null=True, blank=True)
    name = _m.CharField(max_length=255)
    lp_type = _m.CharField(max_length=32, choices=TYPES, default="Individual")
    commitment_cents   = _m.BigIntegerField(default=0)
    contributed_cents  = _m.BigIntegerField(default=0)
    distributions_cents= _m.BigIntegerField(default=0)
    nav_cents          = _m.BigIntegerField(default=0)
    entry_date = _m.DateField(null=True, blank=True)
    created_at = _m.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
