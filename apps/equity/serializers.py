"""apps/equity/serializers.py"""
from rest_framework import serializers
from .models import Company, ShareClass, Stakeholder, FundingRound, Security, VestingSchedule, Exercise, ComplianceRecord
from datetime import date


class ShareClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareClass
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]


class StakeholderSerializer(serializers.ModelSerializer):
    total_shares = serializers.SerializerMethodField()

    class Meta:
        model = Stakeholder
        exclude = ["company", "tax_id"]   # never serialize tax_id to client
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_total_shares(self, obj):
        return obj.securities.filter(status="active").aggregate(
            total=serializers.IntegerField()
        ).get("total") or 0


class VestingScheduleSerializer(serializers.ModelSerializer):
    vest_percent = serializers.SerializerMethodField()
    vested_shares_as_of_today = serializers.SerializerMethodField()

    class Meta:
        model = VestingSchedule
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_vest_percent(self, obj):
        return round(obj.vest_percent() * 100, 2)

    def get_vested_shares_as_of_today(self, obj):
        try:
            return obj.vested_shares(obj.security.shares_issued)
        except Exception:
            return None


class FundingRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = FundingRound
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]


class SecuritySerializer(serializers.ModelSerializer):
    stakeholder_name = serializers.CharField(source="stakeholder.name", read_only=True)
    share_class_name = serializers.CharField(source="share_class.name", read_only=True)
    share_class_type = serializers.CharField(source="share_class.cls_type", read_only=True)
    holder_type      = serializers.CharField(source="stakeholder.holder_type", read_only=True)
    vesting          = VestingScheduleSerializer(source="vesting_schedule", read_only=True)

    price_per_share_dollars = serializers.SerializerMethodField()
    vested_shares           = serializers.SerializerMethodField()
    unvested_shares         = serializers.SerializerMethodField()
    vest_percent            = serializers.SerializerMethodField()
    basic_ownership_pct     = serializers.SerializerMethodField()
    fully_diluted_pct       = serializers.SerializerMethodField()

    class Meta:
        model = Security
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at", "certificate_number"]

    def get_price_per_share_dollars(self, obj):
        return round(obj.price_per_share_dollars, 6) if obj.price_per_share else None

    def get_vested_shares(self, obj):
        return obj.vested_shares

    def get_unvested_shares(self, obj):
        return obj.unvested_shares

    def get_vest_percent(self, obj):
        if not obj.vesting_schedule:
            return 100.0
        return round(obj.vesting_schedule.vest_percent() * 100, 2)

    def _get_fd_total(self, obj):
        return obj.__class__.objects.filter(
            company=obj.company, status="active"
        ).aggregate(total=serializers.IntegerField()).get("total") or 1

    def get_basic_ownership_pct(self, obj):
        from django.db.models import Sum
        total = Security.objects.filter(
            company=obj.company, status="active",
        ).exclude(share_class__cls_type="option").aggregate(
            total=Sum("shares_issued")
        )["total"] or 1
        return round(obj.shares_issued / total * 100, 4)

    def get_fully_diluted_pct(self, obj):
        from django.db.models import Sum
        total = Security.objects.filter(
            company=obj.company, status="active"
        ).aggregate(total=Sum("shares_issued"))["total"] or 1
        return round(obj.shares_issued / total * 100, 4)


class SecurityCreateSerializer(serializers.ModelSerializer):
    """Used for creating new securities — includes vesting schedule creation."""

    vesting_total_months = serializers.IntegerField(required=False, write_only=True)
    vesting_cliff_months = serializers.IntegerField(required=False, write_only=True)
    vesting_start_date   = serializers.DateField(required=False, write_only=True)

    class Meta:
        model = Security
        fields = [
            "stakeholder", "share_class", "funding_round",
            "shares_authorized", "shares_issued",
            "price_per_share", "grant_date", "expiry_date",
            "board_approval_date", "board_approval_ref",
            "form_83b_required", "notes",
            "vesting_total_months", "vesting_cliff_months", "vesting_start_date",
        ]

    def validate_price_per_share(self, value):
        """Validate option price is not below 409A FMV."""
        company = self.context["request"].company
        share_class_id = self.initial_data.get("share_class")
        if share_class_id:
            from .models import ShareClass
            try:
                sc = ShareClass.objects.get(id=share_class_id, company=company)
                if sc.cls_type == "option" and company.latest_409a_pps:
                    if value < company.latest_409a_pps:
                        raise serializers.ValidationError(
                            f"Option price ${value/1_000_000:.4f} is below the current 409A FMV "
                            f"${company.latest_409a_pps/1_000_000:.4f}. "
                            "This violates IRC §409A and may trigger significant tax penalties."
                        )
            except ShareClass.DoesNotExist:
                pass
        return value

    def create(self, validated_data):
        vest_months = validated_data.pop("vesting_total_months", None)
        cliff_months = validated_data.pop("vesting_cliff_months", 12)
        vest_start = validated_data.pop("vesting_start_date", None)

        security = Security.objects.create(
            company=self.context["request"].company,
            **validated_data
        )

        if vest_months and vest_start:
            VestingSchedule.objects.create(
                company=self.context["request"].company,
                security=security,
                total_months=vest_months,
                cliff_months=cliff_months,
                start_date=vest_start,
            )

        return security


class ExerciseSerializer(serializers.ModelSerializer):
    holder_name = serializers.CharField(source="security.stakeholder.name", read_only=True)
    spread_dollars = serializers.FloatField(read_only=True)

    class Meta:
        model = Exercise
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at", "form_3921_required"]

    def validate(self, attrs):
        security = attrs["security"]
        if security.share_class.cls_type == "option":
            attrs["form_3921_required"] = security.share_class.name.startswith("ISO") or "ISO" in security.share_class.name
        # Ensure exercise price matches security price
        if attrs.get("exercise_price") and security.price_per_share:
            if attrs["exercise_price"] != security.price_per_share:
                raise serializers.ValidationError(
                    "Exercise price must equal the security's grant price."
                )
        # Cannot exercise more than vested shares
        already_exercised = Exercise.objects.filter(security=security).aggregate(
            total=serializers.IntegerField()
        )["total"] or 0
        if attrs["shares_exercised"] + already_exercised > security.vested_shares:
            raise serializers.ValidationError(
                f"Cannot exercise {attrs['shares_exercised']} shares — only "
                f"{security.vested_shares - already_exercised} vested and unexercised."
            )
        return attrs


class ComplianceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceRecord
        exclude = ["company"]
        read_only_fields = ["id", "created_at", "updated_at"]


class CompanySerializer(serializers.ModelSerializer):
    latest_409a_pps_dollars = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "legal_name", "state_of_inc", "entity_type",
            "date_incorporated", "fiscal_year_end",
            "latest_409a_value", "latest_409a_date", "latest_409a_pps_dollars",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_latest_409a_pps_dollars(self, obj):
        return round(obj.pps_dollars, 6)


class CapTableSummarySerializer(serializers.Serializer):
    """Aggregated cap table view — shares totals by class and holder."""
    authorized_shares = serializers.DictField()
    issued_shares     = serializers.DictField()
    fully_diluted     = serializers.IntegerField()
    post_money_valuation_cents = serializers.IntegerField(allow_null=True)
    holders           = serializers.ListField()
    compliance        = serializers.DictField()
