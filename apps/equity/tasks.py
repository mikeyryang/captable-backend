"""apps/equity/tasks.py

Celery tasks for async compliance monitoring.
These run on the `compliance` queue via Celery Beat.
"""
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@shared_task(queue="compliance", bind=True, max_retries=3)
def run_compliance_checks_for_company(self, company_id: str):
    """
    Run all 5 compliance checks for a single company and email
    the owner(s) if any critical or warning issues are found.
    Called nightly by Celery Beat.
    """
    from apps.equity.models import Company
    from apps.equity.compliance import run_all_checks
    from apps.accounts.models import CompanyMembership

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        logger.warning(f"Company {company_id} not found — skipping compliance check")
        return

    results = run_all_checks(company)
    summary = results["summary"]

    if summary["overall"] == "ok":
        return  # No issues — don't email

    # Collect owner/admin emails
    admin_emails = list(
        CompanyMembership.objects.filter(
            company=company, role__in=["owner", "admin"]
        ).values_list("user__email", flat=True)
    )

    if not admin_emails:
        return

    critical_items = [
        f"• {name}: {results['checks'][k]['msg']}"
        for k, name in [
            ("a409","409A Valuation"), ("r701","Rule 701"),
            ("b83","83(b) Elections"), ("qsbs","QSBS §1202"), ("f3921","Form 3921"),
        ]
        if results["checks"][k]["status"] == "critical"
    ]
    warning_items = [
        f"• {name}: {results['checks'][k]['msg']}"
        for k, name in [
            ("a409","409A Valuation"), ("r701","Rule 701"),
            ("b83","83(b) Elections"), ("qsbs","QSBS §1202"), ("f3921","Form 3921"),
        ]
        if results["checks"][k]["status"] == "warning"
    ]

    lines = [f"Cap table compliance report for {company.name}:\n"]
    if critical_items:
        lines.append("CRITICAL — immediate action required:")
        lines.extend(critical_items)
        lines.append("")
    if warning_items:
        lines.append("WARNINGS:")
        lines.extend(warning_items)

    send_mail(
        subject=f"[{summary['overall'].upper()}] Cap table compliance alert — {company.name}",
        message="\n".join(lines),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=admin_emails,
        fail_silently=False,
    )
    logger.info(f"Compliance alert sent for {company.name} to {admin_emails}")


@shared_task(queue="compliance")
def run_compliance_checks_all_companies():
    """
    Master task — dispatches per-company checks.
    Called by Celery Beat every night at 06:00 UTC.
    """
    from apps.equity.models import Company
    for company in Company.objects.all().values_list("id", flat=True):
        run_compliance_checks_for_company.delay(str(company))


@shared_task(queue="compliance")
def check_upcoming_409a_expirations():
    """
    Warn companies whose 409A valuation will expire within 60 days.
    """
    from datetime import date, timedelta
    from apps.equity.models import Company
    from apps.accounts.models import CompanyMembership

    warn_date = date.today() + timedelta(days=60)
    expiring = Company.objects.filter(
        latest_409a_date__isnull=False,
        latest_409a_date__lte=warn_date,
    )

    for company in expiring:
        admin_emails = list(
            CompanyMembership.objects.filter(
                company=company, role__in=["owner","admin"]
            ).values_list("user__email", flat=True)
        )
        if not admin_emails:
            continue

        from dateutil.relativedelta import relativedelta
        months_old = relativedelta(date.today(), company.latest_409a_date)
        days_left = (company.latest_409a_date + timedelta(days=365) - date.today()).days

        send_mail(
            subject=f"[Action Required] 409A valuation expires in {days_left} days — {company.name}",
            message=(
                f"The 409A valuation for {company.name} (dated {company.latest_409a_date}) "
                f"will expire in {days_left} days.\n\n"
                "Under IRS §409A, options must be granted at or above fair market value "
                "substantiated by a qualified appraisal within the prior 12 months. "
                "Granting options after expiry creates significant tax risk for your employees.\n\n"
                "Order a new 409A valuation immediately."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
        )


@shared_task(queue="compliance")
def check_vesting_cliff_events():
    """
    Notify employees whose vesting cliff is hit within the next 7 days.
    """
    from datetime import date, timedelta
    from apps.equity.models import Security
    from dateutil.relativedelta import relativedelta
    from django.core.mail import send_mail

    today = date.today()
    for security in Security.objects.filter(
        status="active",
        vesting_schedule__isnull=False,
    ).select_related("stakeholder", "vesting_schedule", "share_class", "company"):

        vs = security.vesting_schedule
        cliff_date = vs.start_date + relativedelta(months=vs.cliff_months)
        days_until_cliff = (cliff_date - today).days

        if 0 <= days_until_cliff <= 7 and security.stakeholder.email:
            cliffing_shares = security.vesting_schedule.vested_shares(security.shares_issued, as_of=cliff_date)
            send_mail(
                subject=f"Your equity cliff vests {'today' if days_until_cliff == 0 else f'in {days_until_cliff} days'} — {security.company.name}",
                message=(
                    f"Hi {security.stakeholder.name},\n\n"
                    f"Your {security.share_class.name} vesting cliff {'has been reached' if days_until_cliff == 0 else f'is in {days_until_cliff} days'} "
                    f"({cliff_date}). After this date, {cliffing_shares:,} shares "
                    f"({security.certificate_number}) will be vested.\n\n"
                    "Log in to your equity portal to view your holdings.\n\n"
                    f"{security.company.name} Equity Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[security.stakeholder.email],
            )
