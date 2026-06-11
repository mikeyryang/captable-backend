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
