"""apps/equity/views.py"""
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404

from .models import Company, ShareClass, Stakeholder, FundingRound, Security, Exercise, ComplianceRecord
from .serializers import (
    CompanySerializer, ShareClassSerializer, StakeholderSerializer,
    FundingRoundSerializer, SecuritySerializer, SecurityCreateSerializer,
    ExerciseSerializer, ComplianceRecordSerializer, CapTableSummarySerializer,
)
from .compliance import run_all_checks
from .permissions import IsCompanyMember, IsCompanyAdmin


class CompanyViewSet(viewsets.ModelViewSet):
    """
    CRUD for the company (tenant root).
    A user can only see companies they're a member of.
    """
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get_queryset(self):
        return Company.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        company = serializer.save()
        # Auto-create owner membership for the creator
        from apps.accounts.models import CompanyMembership
        CompanyMembership.objects.create(
            user=self.request.user,
            company=company,
            role="owner",
        )

    @action(detail=True, methods=["get"])
    def cap_table_summary(self, request, pk=None):
        """
        Returns the full cap table summary for a company:
        - Authorized vs issued shares by class
        - Fully diluted share count
        - Per-holder ownership percentages
        - Live compliance results
        """
        company = self.get_object()

        # Aggregate shares by class
        securities = Security.objects.filter(
            company=company, status="active"
        ).select_related("share_class", "stakeholder", "vesting_schedule")

        fd_total = securities.aggregate(total=Sum("shares_issued"))["total"] or 0
        issued_by_class = {}
        for s in securities:
            cls_name = s.share_class.name
            issued_by_class[cls_name] = issued_by_class.get(cls_name, 0) + s.shares_issued

        auth_by_class = {
            sc.name: sc.authorized_shares
            for sc in ShareClass.objects.filter(company=company)
        }

        # Per-holder breakdown
        holders = []
        from itertools import groupby
        holder_map = {}
        for s in securities:
            hid = str(s.stakeholder_id)
            if hid not in holder_map:
                holder_map[hid] = {
                    "id": hid,
                    "name": s.stakeholder.name,
                    "type": s.stakeholder.holder_type,
                    "total_shares": 0,
                    "securities": [],
                }
            holder_map[hid]["total_shares"] += s.shares_issued
            holder_map[hid]["securities"].append({
                "id": str(s.id),
                "cert": s.certificate_number,
                "class": s.share_class.name,
                "shares": s.shares_issued,
                "vested": s.vested_shares,
                "pct_fd": round(s.shares_issued / fd_total * 100, 4) if fd_total else 0,
            })

        for h in holder_map.values():
            h["pct_fd"] = round(h["total_shares"] / fd_total * 100, 4) if fd_total else 0
            holders.append(h)

        holders.sort(key=lambda x: -x["total_shares"])

        # Last round post-money
        last_round = FundingRound.objects.filter(company=company).order_by("-close_date").first()

        # Compliance
        compliance = run_all_checks(company)

        return Response({
            "authorized_shares": auth_by_class,
            "issued_shares": issued_by_class,
            "fully_diluted": fd_total,
            "post_money_valuation_cents": last_round.post_money_valuation if last_round else None,
            "holders": holders,
            "compliance": compliance,
        })

    @action(detail=True, methods=["get"])
    def compliance(self, request, pk=None):
        """Run all compliance checks for this company."""
        company = self.get_object()
        result = run_all_checks(company)
        return Response(result)

    @action(detail=True, methods=["post"])
    def update_409a(self, request, pk=None):
        """Record a new 409A valuation."""
        company = self.get_object()
        val_date  = request.data.get("valuation_date")
        pps_float = request.data.get("price_per_share_dollars")   # e.g. 0.42
        val_cents = request.data.get("company_value_dollars")     # e.g. 4200000

        if not all([val_date, pps_float]):
            return Response({"error": "valuation_date and price_per_share_dollars are required."}, status=400)

        pps_micro = int(float(pps_float) * 1_000_000)
        val_cents_int = int(float(val_cents) * 100) if val_cents else None

        company.latest_409a_date  = val_date
        company.latest_409a_pps   = pps_micro
        company.latest_409a_value = val_cents_int
        company.save(update_fields=["latest_409a_date", "latest_409a_pps", "latest_409a_value", "updated_at"])

        # Log the compliance event
        ComplianceRecord.objects.create(
            company=company,
            event_type="valuation_409a",
            event_date=val_date,
            performed_by=request.user,
            value_cents=val_cents_int,
            notes=f"409A updated to ${float(pps_float):.4f}/share by {request.user.email}",
        )

        return Response(CompanySerializer(company).data)

    @action(detail=True, methods=["get"])
    def waterfall(self, request, pk=None):
        """
        Compute exit distribution for a given exit valuation.
        Query param: ?exit_value=25000000 (in dollars)
        """
        company = self.get_object()
        exit_dollars = float(request.query_params.get("exit_value", 25_000_000))
        exit_cents = int(exit_dollars * 100)

        share_classes = ShareClass.objects.filter(company=company).order_by("-seniority")
        securities = Security.objects.filter(company=company, status="active").select_related("share_class", "stakeholder")
        fd_total = securities.aggregate(total=Sum("shares_issued"))["total"] or 1

        remaining_cents = exit_cents
        distributions = []

        for sc in share_classes:
            if sc.cls_type != "preferred":
                continue
            sc_securities = [s for s in securities if s.share_class_id == sc.id]
            total_shares = sum(s.shares_issued for s in sc_securities)
            total_invested = sum((s.price_per_share or 0) * s.shares_issued / 1_000_000 * 100 for s in sc_securities)

            # 1× non-participating: holders take HIGHER of pref OR pro-rata
            pro_rata_cents = exit_cents * total_shares / fd_total if fd_total else 0
            liq_pref_cents = total_invested * float(sc.liq_pref_multiple)

            if sc.liquidation_preference == "non_participating":
                payout = min(remaining_cents, max(liq_pref_cents, pro_rata_cents))
                if pro_rata_cents > liq_pref_cents:
                    note = "Converted to common (pro-rata exceeds preference)"
                else:
                    note = f"1× liquidation preference (${liq_pref_cents/100:,.0f})"
            else:
                payout = min(remaining_cents, liq_pref_cents)
                note = f"Participating preferred"

            remaining_cents -= payout
            distributions.append({
                "class": sc.name,
                "type": "preferred",
                "shares": total_shares,
                "payout_cents": payout,
                "payout_dollars": round(payout / 100, 2),
                "pct_of_exit": round(payout / exit_cents * 100, 2) if exit_cents else 0,
                "note": note,
            })

        # Common + converted preferred share the remainder pro-rata
        common_securities = [s for s in securities if s.share_class.cls_type in ("common", "option")]
        common_total = sum(s.shares_issued for s in common_securities)
        if common_total and remaining_cents > 0:
            distributions.append({
                "class": "Common",
                "type": "common",
                "shares": common_total,
                "payout_cents": remaining_cents,
                "payout_dollars": round(remaining_cents / 100, 2),
                "pct_of_exit": round(remaining_cents / exit_cents * 100, 2) if exit_cents else 0,
                "note": "Pro-rata distribution",
            })

        return Response({
            "exit_value_dollars": exit_dollars,
            "distributions": distributions,
            "total_paid_cents": exit_cents - max(0, remaining_cents - (remaining_cents if not distributions else 0)),
        })

    @action(detail=True, methods=["get"])
    def scenario_model(self, request, pk=None):
        """
        Model a new round: compute dilution and post-round ownership table.
        Query params:
            raise_amount=5000000    (in dollars)
            pre_money=15000000      (in dollars)
        """
        company = self.get_object()
        raise_amount = float(request.query_params.get("raise_amount", 5_000_000))
        pre_money    = float(request.query_params.get("pre_money", 15_000_000))

        securities = Security.objects.filter(
            company=company, status="active"
        ).select_related("share_class", "stakeholder")
        fd_total = securities.aggregate(total=Sum("shares_issued"))["total"] or 1

        pps = pre_money / fd_total
        new_shares = round(raise_amount / pps)
        post_money = pre_money + raise_amount
        new_fd = fd_total + new_shares
        dilution = new_shares / new_fd

        # Build before/after ownership table
        holder_map = {}
        for s in securities:
            hid = str(s.stakeholder_id)
            if hid not in holder_map:
                holder_map[hid] = {"name": s.stakeholder.name, "type": s.stakeholder.holder_type, "shares": 0}
            holder_map[hid]["shares"] += s.shares_issued

        ownership_table = []
        for h in holder_map.values():
            ownership_table.append({
                "holder": h["name"],
                "type": h["type"],
                "shares": h["shares"],
                "before_pct": round(h["shares"] / fd_total * 100, 4),
                "after_pct": round(h["shares"] / new_fd * 100, 4),
                "delta_pct": round((h["shares"] / new_fd - h["shares"] / fd_total) * 100, 4),
            })

        ownership_table.append({
            "holder": "New investor",
            "type": "investor",
            "shares": new_shares,
            "before_pct": 0,
            "after_pct": round(new_shares / new_fd * 100, 4),
            "delta_pct": round(new_shares / new_fd * 100, 4),
        })

        ownership_table.sort(key=lambda x: -x["shares"])

        return Response({
            "pre_money_dollars": pre_money,
            "raise_amount_dollars": raise_amount,
            "post_money_dollars": post_money,
            "pps_dollars": round(pps, 6),
            "new_shares": new_shares,
            "new_fd_total": new_fd,
            "dilution_pct": round(dilution * 100, 4),
            "ownership_table": ownership_table,
        })


class ShareClassViewSet(viewsets.ModelViewSet):
    serializer_class = ShareClassSerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get_queryset(self):
        return ShareClass.objects.filter(company_id=self.kwargs["company_pk"])

    def perform_create(self, serializer):
        company = get_object_or_404(Company, id=self.kwargs["company_pk"])
        serializer.save(company=company)


class StakeholderViewSet(viewsets.ModelViewSet):
    serializer_class = StakeholderSerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]
    filterset_fields = ["holder_type"]
    search_fields = ["name", "email"]

    def get_queryset(self):
        return Stakeholder.objects.filter(company_id=self.kwargs["company_pk"])

    def perform_create(self, serializer):
        company = get_object_or_404(Company, id=self.kwargs["company_pk"])
        serializer.save(company=company)


class SecurityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsCompanyMember]
    filterset_fields = ["status", "share_class__cls_type"]
    search_fields = ["stakeholder__name", "certificate_number"]
    ordering_fields = ["grant_date", "shares_issued"]

    def get_serializer_class(self):
        if self.action == "create":
            return SecurityCreateSerializer
        return SecuritySerializer

    def get_queryset(self):
        return Security.objects.filter(
            company_id=self.kwargs["company_pk"]
        ).select_related("stakeholder", "share_class", "vesting_schedule")

    def perform_create(self, serializer):
        company = get_object_or_404(Company, id=self.kwargs["company_pk"])
        serializer.save(company=company)

    @action(detail=True, methods=["post"])
    def cancel(self, request, company_pk=None, pk=None):
        """Cancel (not delete) a security."""
        security = self.get_object()
        if security.status != "active":
            return Response({"error": f"Cannot cancel a security with status '{security.status}'."}, status=400)
        from django.utils import timezone
        security.status = "cancelled"
        security.cancelled_at = timezone.now()
        security.cancelled_reason = request.data.get("reason", "")
        security.save()
        return Response(SecuritySerializer(security).data)

    @action(detail=True, methods=["post"])
    def file_83b(self, request, company_pk=None, pk=None):
        """Mark an 83(b) election as filed."""
        security = self.get_object()
        filed_date = request.data.get("filed_date")
        if not filed_date:
            return Response({"error": "filed_date is required."}, status=400)
        security.form_83b_filed = True
        security.form_83b_filed_at = filed_date
        security.save(update_fields=["form_83b_filed", "form_83b_filed_at", "updated_at"])
        ComplianceRecord.objects.create(
            company=security.company,
            event_type="form_83b_filed",
            event_date=filed_date,
            security=security,
            performed_by=request.user,
            notes=f"83(b) election filed for {security.stakeholder.name}",
        )
        return Response(SecuritySerializer(security).data)


class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated, IsCompanyAdmin]

    def get_queryset(self):
        return Exercise.objects.filter(
            company_id=self.kwargs["company_pk"]
        ).select_related("security__stakeholder")

    def perform_create(self, serializer):
        company = get_object_or_404(Company, id=self.kwargs["company_pk"])
        exercise = serializer.save(
            company=company,
            fmv_at_exercise=company.latest_409a_pps,  # snapshot current 409A
        )
        # Automatically set Form 3921 requirement for ISOs
        if "ISO" in (exercise.security.share_class.name or ""):
            exercise.form_3921_required = True
            exercise.save(update_fields=["form_3921_required"])

    @action(detail=True, methods=["post"])
    def file_3921(self, request, company_pk=None, pk=None):
        """Mark Form 3921 as filed for this exercise."""
        exercise = self.get_object()
        filed_date = request.data.get("filed_date")
        if not filed_date:
            return Response({"error": "filed_date is required."}, status=400)
        exercise.form_3921_filed = True
        exercise.form_3921_filed_at = filed_date
        exercise.save(update_fields=["form_3921_filed", "form_3921_filed_at"])
        ComplianceRecord.objects.create(
            company=exercise.company,
            event_type="form_3921_filed",
            event_date=filed_date,
            security=exercise.security,
            performed_by=request.user,
            notes=f"Form 3921 filed for {exercise.security.stakeholder.name} ({exercise.shares_exercised} shares, exercise date {exercise.exercise_date})",
        )
        return Response(ExerciseSerializer(exercise).data)


class FundingRoundViewSet(viewsets.ModelViewSet):
    serializer_class = FundingRoundSerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get_queryset(self):
        return FundingRound.objects.filter(company_id=self.kwargs["company_pk"])

    def perform_create(self, serializer):
        company = get_object_or_404(Company, id=self.kwargs["company_pk"])
        serializer.save(company=company)


class ComplianceRecordViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only view of the immutable compliance event log."""
    serializer_class = ComplianceRecordSerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]
    filterset_fields = ["event_type"]
    ordering = ["-event_date"]

    def get_queryset(self):
        return ComplianceRecord.objects.filter(company_id=self.kwargs["company_pk"])
