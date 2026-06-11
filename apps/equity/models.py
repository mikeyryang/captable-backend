"""apps/equity/models.py

The complete equity data model. Every table is immutable-by-convention:
updates go through explicit state transitions, never raw UPDATE on financial fields.
All monetary values stored as integers (cents or basis points) to avoid float errors.
"""
from django.db import models
from django.core.validators import MinValueValidator
from apps.core.models import TimeStampedModel, TenantModel
import uuid


# ══════════════════════════════════════════════════════════════════
# COMPANY (the cap table owner / tenant root)
# ══════════════════════════════════════════════════════════════════

class Company(TimeStampedModel):
    """
    Root tenant object. Every other equity record references this.
    Row-level security is enforced by filtering on company_id everywhere.
    """
    ENTITY_TYPES = [
        ("c_corp",    "C-Corporation"),
        ("s_corp",    "S-Corporation"),
        ("llc",       "LLC"),
        ("lp",        "Limited Partnership"),
    ]

    name             = models.CharField(max_length=255)
    legal_name       = models.CharField(max_length=255, blank=True)
    state_of_inc     = models.CharField(max_length=50, default="Delaware")
    entity_type      = models.CharField(max_length=20, choices=ENTITY_TYPES, default="c_corp")
    ein              = models.CharField(max_length=20, blank=True)
    date_incorporated = models.DateField(null=True, blank=True)
    fiscal_year_end  = models.CharField(max_length=5, default="12-31", help_text="MM-DD")

    # 409A state — tracked here, linked to ComplianceRecord for history
    latest_409a_value   = models.BigIntegerField(null=True, blank=True, help_text="FMV in cents")
    latest_409a_pps     = models.BigIntegerField(null=True, blank=True, help_text="Price per share in microdollars (millionths)")
    latest_409a_date    = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name

    @property
    def pps_dollars(self):
        """409A price per share in dollars (for display/logic)."""
        return (self.latest_409a_pps or 0) / 1_000_000


# ══════════════════════════════════════════════════════════════════
# SHARE CLASS
# ══════════════════════════════════════════════════════════════════

class ShareClass(TenantModel):
    """
    Defines a class of equity (Common, Series A Preferred, etc.)
    and its key economic terms.
    """
    TYPE_CHOICES = [
        ("common",    "Common"),
        ("preferred", "Preferred"),
        ("option",    "Option"),
        ("warrant",   "Warrant"),
        ("safe",      "SAFE"),
        ("note",      "Convertible Note"),
    ]
    LIQ_PREF_CHOICES = [
        ("non_participating",          "1× Non-Participating"),
        ("participating",              "Participating"),
        ("participating_capped",       "Participating (Capped)"),
    ]

    name         = models.CharField(max_length=100)         # "Series A Preferred"
    short_name   = models.CharField(max_length=20, blank=True)   # "Series A"
    cls_type     = models.CharField(max_length=20, choices=TYPE_CHOICES)
    authorized_shares = models.BigIntegerField(default=0)
    original_issue_price = models.BigIntegerField(default=0, help_text="In cents")  # $1.00 = 100
    liquidation_preference = models.CharField(max_length=30, choices=LIQ_PREF_CHOICES, blank=True)
    liq_pref_multiple = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    conversion_ratio  = models.DecimalField(max_digits=10, decimal_places=6, default=1)
    anti_dilution     = models.CharField(max_length=30, blank=True, help_text="broad_based_ratchet / full_ratchet / none")
    voting_ratio      = models.DecimalField(max_digits=10, decimal_places=4, default=1, help_text="votes per share")
    seniority         = models.PositiveSmallIntegerField(default=0, help_text="0 = most junior; higher = more senior")

    class Meta:
        unique_together = ("company", "name")
        ordering = ["-seniority", "name"]

    def __str__(self):
        return f"{self.company.name} / {self.name}"


# ══════════════════════════════════════════════════════════════════
# STAKEHOLDER
# ══════════════════════════════════════════════════════════════════

class Stakeholder(TenantModel):
    """
    A person or entity that holds (or may hold) securities.
    Separate from User — a stakeholder may not have platform access.
    """
    TYPE_CHOICES = [
        ("founder",  "Founder"),
        ("investor", "Investor"),
        ("employee", "Employee"),
        ("advisor",  "Advisor"),
        ("board",    "Board Member"),
        ("other",    "Other"),
    ]
    ENTITY_CHOICES = [
        ("individual", "Individual"),
        ("fund",       "Investment Fund"),
        ("trust",      "Trust"),
        ("corp",       "Corporation"),
    ]

    name         = models.CharField(max_length=255)
    email        = models.EmailField(blank=True)
    holder_type  = models.CharField(max_length=20, choices=TYPE_CHOICES)
    entity_type  = models.CharField(max_length=20, choices=ENTITY_CHOICES, default="individual")
    user         = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="stakeholdings",
        help_text="Linked platform account (optional)"
    )
    address      = models.TextField(blank=True)
    tax_id       = models.CharField(max_length=20, blank=True, help_text="SSN or EIN — store encrypted in production")
    is_accredited = models.BooleanField(default=False)

    class Meta:
        unique_together = ("company", "email")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_holder_type_display()})"


# ══════════════════════════════════════════════════════════════════
# FUNDING ROUND
# ══════════════════════════════════════════════════════════════════

class FundingRound(TenantModel):
    """
    A discrete financing event. Securities can be linked to a round.
    """
    ROUND_TYPES = [
        ("founding",  "Founding / Incorporation"),
        ("safe",      "SAFE / Note Round"),
        ("seed",      "Seed"),
        ("series_a",  "Series A"),
        ("series_b",  "Series B"),
        ("series_c",  "Series C"),
        ("growth",    "Growth / Later Stage"),
        ("secondary", "Secondary"),
        ("ipo",       "IPO"),
    ]

    name           = models.CharField(max_length=100)
    round_type     = models.CharField(max_length=20, choices=ROUND_TYPES)
    close_date     = models.DateField()
    pre_money_valuation = models.BigIntegerField(null=True, blank=True, help_text="In cents")
    post_money_valuation = models.BigIntegerField(null=True, blank=True, help_text="In cents")
    amount_raised  = models.BigIntegerField(null=True, blank=True, help_text="In cents")
    price_per_share = models.BigIntegerField(null=True, blank=True, help_text="In cents")
    share_class    = models.ForeignKey(ShareClass, null=True, blank=True, on_delete=models.SET_NULL)
    notes          = models.TextField(blank=True)

    class Meta:
        ordering = ["close_date"]

    def __str__(self):
        return f"{self.company.name} / {self.name}"


# ══════════════════════════════════════════════════════════════════
# VESTING SCHEDULE
# ══════════════════════════════════════════════════════════════════

class VestingSchedule(TenantModel):
    """
    Vesting terms attached to a Security. Supports standard 4yr/1yr cliff
    and custom milestone-based schedules.
    """
    SCHEDULE_TYPES = [
        ("time",      "Time-based"),
        ("milestone", "Milestone-based"),
        ("hybrid",    "Hybrid"),
    ]

    schedule_type  = models.CharField(max_length=20, choices=SCHEDULE_TYPES, default="time")
    total_months   = models.PositiveSmallIntegerField(default=48, help_text="Total vesting period in months")
    cliff_months   = models.PositiveSmallIntegerField(default=12, help_text="Cliff in months (0 = no cliff)")
    start_date     = models.DateField()
    acceleration   = models.CharField(max_length=30, blank=True, help_text="single_trigger / double_trigger / none")

    class Meta:
        verbose_name = "Vesting Schedule"

    def vested_shares(self, total_shares: int, as_of=None) -> int:
        """
        Calculate how many of `total_shares` are vested as of `as_of`.
        Returns integer (no fractional shares).
        """
        from datetime import date
        from dateutil.relativedelta import relativedelta

        as_of = as_of or date.today()
        delta = relativedelta(as_of, self.start_date)
        months_elapsed = delta.years * 12 + delta.months

        if months_elapsed < self.cliff_months:
            return 0

        if months_elapsed >= self.total_months:
            return total_shares

        return int(total_shares * months_elapsed / self.total_months)

    def vest_percent(self, as_of=None) -> float:
        from datetime import date
        from dateutil.relativedelta import relativedelta
        as_of = as_of or date.today()
        delta = relativedelta(as_of, self.start_date)
        months_elapsed = delta.years * 12 + delta.months
        if months_elapsed < self.cliff_months:
            return 0.0
        return min(1.0, months_elapsed / self.total_months)


# ══════════════════════════════════════════════════════════════════
# SECURITY (the core ledger entry)
# ══════════════════════════════════════════════════════════════════

class Security(TenantModel):
    """
    A single security issuance — the core row in the cap table.

    Design principles:
    - Financial fields (shares, price) are immutable after creation.
      Amendments create a new Security and cancel the old one.
    - Status transitions are explicit and logged via auditlog.
    - Never store price as float: use integer cents/microdollars.
    """
    STATUS_CHOICES = [
        ("active",     "Active"),
        ("cancelled",  "Cancelled"),
        ("exercised",  "Exercised"),
        ("expired",    "Expired"),
        ("transferred","Transferred"),
    ]
    CERT_PREFIX = {
        "common":    "CS",
        "preferred": "PS",
        "option":    "OPT",
        "warrant":   "WRT",
        "safe":      "SAFE",
        "note":      "CN",
    }

    # ── Core fields ──────────────────────────────────────────
    stakeholder  = models.ForeignKey(Stakeholder, on_delete=models.PROTECT, related_name="securities")
    share_class  = models.ForeignKey(ShareClass, on_delete=models.PROTECT, related_name="securities")
    funding_round = models.ForeignKey(FundingRound, null=True, blank=True, on_delete=models.SET_NULL)
    vesting_schedule = models.OneToOneField(
        VestingSchedule, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="security"
    )

    # ── Shares & price (immutable after issue) ───────────────
    shares_authorized = models.BigIntegerField(validators=[MinValueValidator(1)])
    shares_issued     = models.BigIntegerField(validators=[MinValueValidator(1)])
    price_per_share   = models.BigIntegerField(
        null=True, blank=True,
        help_text="In microdollars (millionths of a dollar). $0.42 = 420000"
    )
    grant_date   = models.DateField(db_index=True)
    expiry_date  = models.DateField(null=True, blank=True, help_text="For options: typically 10 years from grant")

    # ── State ────────────────────────────────────────────────
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.TextField(blank=True)

    # ── Certificate / reference ──────────────────────────────
    certificate_number = models.CharField(max_length=50, blank=True, unique=True)
    board_approval_date = models.DateField(null=True, blank=True, help_text="Date board approved this issuance")
    board_approval_ref  = models.CharField(max_length=100, blank=True, help_text="Board consent reference number")

    # ── Compliance flags ─────────────────────────────────────
    form_83b_required = models.BooleanField(default=False)
    form_83b_filed    = models.BooleanField(default=False)
    form_83b_filed_at = models.DateField(null=True, blank=True)

    qsbs_eligible = models.BooleanField(null=True, blank=True, help_text="Null = not yet evaluated")

    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = "Securities"
        ordering = ["grant_date", "certificate_number"]
        indexes = [
            models.Index(fields=["company", "status"]),
            models.Index(fields=["company", "grant_date"]),
        ]

    def __str__(self):
        return f"{self.certificate_number or self.id} — {self.stakeholder.name}"

    @property
    def price_per_share_dollars(self) -> float:
        return (self.price_per_share or 0) / 1_000_000

    @property
    def vested_shares(self):
        if not self.vesting_schedule:
            return self.shares_issued
        return self.vesting_schedule.vested_shares(self.shares_issued)

    @property
    def unvested_shares(self):
        return self.shares_issued - self.vested_shares

    def save(self, *args, **kwargs):
        # Auto-generate certificate number if missing
        if not self.certificate_number and self.share_class_id:
            prefix = self.CERT_PREFIX.get(self.share_class.cls_type, "SEC")
            # Next sequential number for this company + class
            last = Security.objects.filter(
                company=self.company,
                share_class__cls_type=self.share_class.cls_type,
                certificate_number__startswith=prefix,
            ).count()
            self.certificate_number = f"{prefix}-{(last + 1):04d}"
        super().save(*args, **kwargs)


# ══════════════════════════════════════════════════════════════════
# EXERCISE (option / warrant exercises)
# ══════════════════════════════════════════════════════════════════

class Exercise(TenantModel):
    """
    Records when an option or warrant holder exercises shares.
    Triggers Form 3921 (ISO) or 3922 (ESPP) requirement tracking.
    Each exercise is immutable — use cancellation + new record to correct.
    """
    security     = models.ForeignKey(Security, on_delete=models.PROTECT, related_name="exercises")
    shares_exercised = models.BigIntegerField(validators=[MinValueValidator(1)])
    exercise_date    = models.DateField()
    exercise_price   = models.BigIntegerField(help_text="In microdollars — must equal security.price_per_share")
    fmv_at_exercise  = models.BigIntegerField(null=True, blank=True, help_text="409A FMV per share on exercise date, microdollars")

    # Spread = (FMV - exercise price) × shares — ordinary income for NSO, AMT for ISO
    form_3921_required = models.BooleanField(default=False, help_text="True for ISO exercises")
    form_3921_filed    = models.BooleanField(default=False)
    form_3921_filed_at = models.DateField(null=True, blank=True)

    payment_method = models.CharField(max_length=20, choices=[("cash","Cash"),("cashless","Cashless"),("net","Net Exercise")], default="cash")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["exercise_date"]

    def __str__(self):
        return f"{self.security} — {self.shares_exercised} shares @ {self.exercise_date}"

    @property
    def spread_dollars(self) -> float:
        if not self.fmv_at_exercise:
            return 0.0
        return ((self.fmv_at_exercise - self.exercise_price) * self.shares_exercised) / 1_000_000


# ══════════════════════════════════════════════════════════════════
# COMPLIANCE RECORD (immutable audit log of compliance events)
# ══════════════════════════════════════════════════════════════════

class ComplianceRecord(TenantModel):
    """
    Append-only log of compliance-related events:
    - 409A valuations received
    - Rule 701 threshold crossings
    - 83(b) elections filed
    - Form 3921/3922 filings
    - QSBS eligibility evaluations

    Never update a ComplianceRecord — create a new one.
    """
    EVENT_TYPES = [
        ("valuation_409a",      "409A Valuation Received"),
        ("rule_701_threshold",  "Rule 701 Threshold Crossed"),
        ("form_83b_filed",      "83(b) Election Filed"),
        ("form_3921_filed",     "Form 3921 Filed"),
        ("qsbs_eval",           "QSBS Eligibility Evaluated"),
        ("board_consent",       "Board Consent Obtained"),
        ("rule_701_disclosure", "Rule 701 Disclosure Delivered"),
    ]

    event_type   = models.CharField(max_length=40, choices=EVENT_TYPES, db_index=True)
    event_date   = models.DateField()
    security     = models.ForeignKey(Security, null=True, blank=True, on_delete=models.SET_NULL, related_name="compliance_events")
    performed_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL)
    value_cents  = models.BigIntegerField(null=True, blank=True, help_text="409A value, threshold amount, etc.")
    notes        = models.TextField(blank=True)
    document     = models.ForeignKey("documents.Document", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-event_date"]

    def __str__(self):
        return f"{self.get_event_type_display()} — {self.event_date}"
