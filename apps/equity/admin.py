from django.contrib import admin
from .models import (
    Company, ShareClass, Stakeholder,
    FundingRound, VestingSchedule, Security,
    Exercise, ComplianceRecord,
)

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display   = ("name", "entity_type", "state_of_inc", "ein", "latest_409a_date", "created_at")
    search_fields  = ("name", "legal_name", "ein")
    list_filter    = ("entity_type", "state_of_inc")
    readonly_fields= ("created_at", "updated_at")
    fieldsets = (
        ("Identity",       {"fields": ("name","legal_name","entity_type","state_of_inc","ein","date_incorporated","fiscal_year_end")}),
        ("409A Valuation", {"fields": ("latest_409a_value","latest_409a_pps","latest_409a_date")}),
        ("Timestamps",     {"fields": ("created_at","updated_at"), "classes": ("collapse",)}),
    )

@admin.register(ShareClass)
class ShareClassAdmin(admin.ModelAdmin):
    list_display   = ("name","company","cls_type","authorized_shares","original_issue_price","seniority")
    search_fields  = ("name","company__name")
    list_filter    = ("cls_type","company")
    readonly_fields= ("created_at","updated_at")

@admin.register(Stakeholder)
class StakeholderAdmin(admin.ModelAdmin):
    list_display   = ("name","company","holder_type","entity_type","email","is_accredited")
    search_fields  = ("name","email","company__name")
    list_filter    = ("holder_type","entity_type","is_accredited","company")
    readonly_fields= ("created_at","updated_at")

@admin.register(FundingRound)
class FundingRoundAdmin(admin.ModelAdmin):
    list_display   = ("name","company","round_type","close_date","amount_raised_display","pre_money_valuation_display")
    search_fields  = ("name","company__name")
    list_filter    = ("round_type","company")
    readonly_fields= ("created_at","updated_at")

    def amount_raised_display(self, obj):
        return f"${obj.amount_raised/100:,.0f}" if obj.amount_raised else "—"
    amount_raised_display.short_description = "Amount Raised"

    def pre_money_valuation_display(self, obj):
        return f"${obj.pre_money_valuation/100:,.0f}" if obj.pre_money_valuation else "—"
    pre_money_valuation_display.short_description = "Pre-Money"

@admin.register(VestingSchedule)
class VestingScheduleAdmin(admin.ModelAdmin):
    list_display   = ("id","company","schedule_type","total_months","cliff_months","start_date","acceleration")
    list_filter    = ("schedule_type","acceleration","company")
    readonly_fields= ("created_at","updated_at")

@admin.register(Security)
class SecurityAdmin(admin.ModelAdmin):
    list_display   = ("certificate_number","stakeholder","share_class","shares_issued","status","grant_date","form_83b_required","qsbs_eligible")
    search_fields  = ("certificate_number","stakeholder__name","share_class__name")
    list_filter    = ("status","form_83b_required","form_83b_filed","qsbs_eligible","company")
    readonly_fields= ("certificate_number","created_at","updated_at")
    fieldsets = (
        ("Security",   {"fields": ("company","stakeholder","share_class","funding_round","certificate_number","status")}),
        ("Shares",     {"fields": ("shares_authorized","shares_issued","price_per_share","grant_date","expiry_date")}),
        ("Vesting",    {"fields": ("vesting_schedule",)}),
        ("Compliance", {"fields": ("form_83b_required","form_83b_filed","form_83b_filed_at","qsbs_eligible","board_approval_date","board_approval_ref")}),
        ("Notes",      {"fields": ("notes",)}),
        ("Timestamps", {"fields": ("created_at","updated_at"), "classes": ("collapse",)}),
    )

@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display   = ("security","shares_exercised","exercise_date","payment_method","form_3921_required","form_3921_filed")
    search_fields  = ("security__certificate_number","security__stakeholder__name")
    list_filter    = ("payment_method","form_3921_required","form_3921_filed")
    readonly_fields= ("created_at","updated_at")

@admin.register(ComplianceRecord)
class ComplianceRecordAdmin(admin.ModelAdmin):
    list_display   = ("event_type","company","event_date","performed_by","value_cents")
    search_fields  = ("notes","company__name")
    list_filter    = ("event_type","company")
    readonly_fields= ("created_at","updated_at")
