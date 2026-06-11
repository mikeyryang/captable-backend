"""apps/equity/permissions.py"""
from rest_framework.permissions import BasePermission
from apps.accounts.models import CompanyMembership


class IsCompanyMember(BasePermission):
    """User must be a member of the company (any role)."""
    def has_permission(self, request, view):
        company_pk = view.kwargs.get("company_pk") or view.kwargs.get("pk")
        if not company_pk:
            return True
        return CompanyMembership.objects.filter(
            user=request.user, company_id=company_pk
        ).exists()


class IsCompanyAdmin(BasePermission):
    """User must be owner or admin of the company."""
    def has_permission(self, request, view):
        company_pk = view.kwargs.get("company_pk") or view.kwargs.get("pk")
        if not company_pk:
            return True
        return CompanyMembership.objects.filter(
            user=request.user,
            company_id=company_pk,
            role__in=["owner", "admin"],
        ).exists()
