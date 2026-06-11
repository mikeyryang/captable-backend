"""apps/equity/compliance.py

Server-side compliance engine. All 5 checks are pure functions that
operate on Django ORM querysets and return structured result dicts.

Each check returns:
    {
        "status":  "ok" | "warning" | "critical",
        "msg":     str,          # human-readable summary
        "action":  str | None,   # required action if not "ok"
        "data":    dict,         # raw computed values for the frontend
    }
"""
from __future__ import annotations
from datetime import date, timedelta
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from django.utils import timezone


# ════════════════════════════════════════════════════════════════
# CHECK 1 — 409A VALUATION STALENESS
# ════════════════════════════════════════════════════════════════

def check_409a(company) -> dict:
    """
    IRC §409A requires a qualified independent appraisal at least every
    12 months (or sooner upon a material event: new priced round, IPO
    intent, acquisition discussions, or >50% asset change).

    Granting options on a stale 409A exposes the company and grantee to:
    - 20% excise tax on the spread at vest
    - Additional state taxes
    - Potential income inclusion at grant
    """
    if not company.latest_409a_date:
        return {
            "status": "critical",
            "msg": "No 409A valuation on record.",
            "action": "Order a 409A valuation immediately before issuing any options.",
            "data": {"months_old": None, "val_date": None, "pps_cents": None},
        }

    today = date.today()
    delta = relativedelta(today, company.latest_409a_date)
    months_old = delta.years * 12 + delta.months

    # Check if there has been a material event since the last valuation
    # (new priced round after the valuation date)
    from apps.equity.models import FundingRound
    material_event = FundingRound.objects.filter(
        company=company,
        round_type__in=["series_a","series_b","series_c","growth","ipo"],
        close_date__gt=company.latest_409a_date,
    ).exists()

    pps = (company.latest_409a_pps or 0) / 1_000_000

    if material_event:
        return {
            "status": "critical",
            "msg": f"A material event (priced round) occurred after your last 409A ({company.latest_409a_date}). The existing valuation is no longer valid.",
            "action": "Order a new 409A valuation before issuing any further options. Options granted after a material event on a stale valuation are at high risk of §409A penalties.",
            "data": {"months_old": months_old, "val_date": str(company.latest_409a_date), "pps_dollars": pps, "material_event": True},
        }

    if months_old > 12:
        return {
            "status": "critical",
            "msg": f"409A valuation is {months_old} months old — exceeds the 12-month IRS safe harbor.",
            "action": "Order a new 409A immediately. Options granted today use a stale FMV and expose grantees to §409A ordinary income treatment at vesting (20% excise + income tax).",
            "data": {"months_old": months_old, "val_date": str(company.latest_409a_date), "pps_dollars": pps, "material_event": False},
        }

    if months_old > 9:
        return {
            "status": "warning",
            "msg": f"409A valuation is {months_old} months old — renewal due within {12 - months_old} months.",
            "action": "Initiate a new 409A now. Valuations typically take 2–4 weeks and you cannot grant options after expiry.",
            "data": {"months_old": months_old, "val_date": str(company.latest_409a_date), "pps_dollars": pps, "material_event": False},
        }

    return {
        "status": "ok",
        "msg": f"409A valuation is current ({months_old} months old, ${ pps:.4f}/share FMV).",
        "action": None,
        "data": {"months_old": months_old, "val_date": str(company.latest_409a_date), "pps_dollars": pps, "material_event": False},
    }


# ════════════════════════════════════════════════════════════════
# CHECK 2 — SEC RULE 701
# ════════════════════════════════════════════════════════════════

def check_rule_701(company) -> dict:
    """
    Rule 701 exempts compensatory equity issuances from SEC registration.

    Thresholds (any 12-month period):
    - Up to the GREATER of:
        (a) $1,000,000
        (b) 15% of total assets of the issuer
        (c) 15% of the outstanding securities of the class being offered
    - If aggregate sales price or amount of securities sold exceeds $10M
      in any 12-month period → must deliver specified disclosures before
      issuance (not just disclose the cap table).
    - The $5M threshold triggers financial statement + risk factor disclosure.

    Value computation: for options, use grant-date FMV × shares.
    """
    from apps.equity.models import Security

    cutoff = date.today() - timedelta(days=365)
    eligible = Security.objects.filter(
        company=company,
        stakeholder__holder_type__in=["employee", "advisor"],
        grant_date__gte=cutoff,
        status="active",
    ).select_related("share_class")

    total_value_cents = sum(
        (s.price_per_share or 0) * s.shares_issued / 1_000_000 * 100   # price is microdollars → cents
        for s in eligible
    )
    total_value_dollars = total_value_cents / 100

    issuances = [
        {
            "holder": s.stakeholder.name,
            "shares": s.shares_issued,
            "grant_date": str(s.grant_date),
            "value_dollars": round((s.price_per_share or 0) * s.shares_issued / 1_000_000, 2),
        }
        for s in eligible
    ]

    THRESHOLD_1M  = 1_000_000
    THRESHOLD_5M  = 5_000_000
    THRESHOLD_10M = 10_000_000

    if total_value_dollars > THRESHOLD_10M:
        return {
            "status": "critical",
            "msg": f"${total_value_dollars:,.0f} issued in trailing 12 months — exceeds $10M offering limit.",
            "action": "STOP issuances immediately. You have exceeded the Rule 701 aggregate limit. Engage securities counsel — you may need to register or rely on another exemption.",
            "data": {"total_dollars": total_value_dollars, "issuances": issuances, "threshold_1m_pct": total_value_dollars/THRESHOLD_1M*100, "threshold_5m_pct": total_value_dollars/THRESHOLD_5M*100},
        }

    if total_value_dollars > THRESHOLD_5M:
        return {
            "status": "critical",
            "msg": f"${total_value_dollars:,.0f} issued in trailing 12 months — enhanced disclosure required.",
            "action": "Before making any further offers, you must deliver: (1) audited financial statements, (2) risk factors, (3) the complete cap table, and (4) a copy of the compensatory plan. Deliver these disclosures a reasonable time before the sale.",
            "data": {"total_dollars": total_value_dollars, "issuances": issuances, "threshold_1m_pct": total_value_dollars/THRESHOLD_1M*100, "threshold_5m_pct": total_value_dollars/THRESHOLD_5M*100},
        }

    if total_value_dollars > THRESHOLD_1M:
        return {
            "status": "warning",
            "msg": f"${total_value_dollars:,.0f} issued in trailing 12 months. Approaching the $5M enhanced-disclosure threshold.",
            "action": "Track cumulative issuances monthly. Prepare financial statements and risk factors in advance so you are not caught issuing without disclosures.",
            "data": {"total_dollars": total_value_dollars, "issuances": issuances, "threshold_1m_pct": total_value_dollars/THRESHOLD_1M*100, "threshold_5m_pct": total_value_dollars/THRESHOLD_5M*100},
        }

    return {
        "status": "ok",
        "msg": f"${total_value_dollars:,.0f} issued in trailing 12 months — within the $1M absolute safe harbor.",
        "action": None,
        "data": {"total_dollars": total_value_dollars, "issuances": issuances, "threshold_1m_pct": total_value_dollars/THRESHOLD_1M*100, "threshold_5m_pct": total_value_dollars/THRESHOLD_5M*100},
    }


# ════════════════════════════════════════════════════════════════
# CHECK 3 — 83(b) ELECTIONS
# ════════════════════════════════════════════════════════════════

def check_83b(company) -> dict:
    """
    IRC §83(b) allows a taxpayer to elect to include restricted property
    in income at its current FMV rather than waiting until the property
    vests. For founders with low-value restricted stock, this means paying
    tax on nearly zero income now instead of potentially large income later.

    The election must be filed with the IRS within 30 days of the grant.
    There is NO extension and NO exception. A missed 83(b) election cannot
    be corrected retroactively.
    """
    from apps.equity.models import Security

    restricted_grants = Security.objects.filter(
        company=company,
        share_class__cls_type="common",
        vesting_schedule__isnull=False,  # restricted = has a vesting schedule
        status="active",
    ).select_related("stakeholder", "vesting_schedule")

    today = date.today()
    overdue = []
    pending = []

    for s in restricted_grants:
        deadline = s.grant_date + timedelta(days=30)
        if s.form_83b_filed:
            continue
        if today > deadline:
            overdue.append({
                "holder": s.stakeholder.name,
                "grant_date": str(s.grant_date),
                "deadline": str(deadline),
                "cert": s.certificate_number,
                "days_overdue": (today - deadline).days,
            })
        else:
            days_left = (deadline - today).days
            pending.append({
                "holder": s.stakeholder.name,
                "grant_date": str(s.grant_date),
                "deadline": str(deadline),
                "cert": s.certificate_number,
                "days_left": days_left,
            })

    if overdue:
        return {
            "status": "critical",
            "msg": f"{len(overdue)} restricted stock grant(s) with expired 83(b) election deadlines.",
            "action": "The 30-day window cannot be extended. Consult a tax attorney immediately. The affected holders may now owe ordinary income tax (and potentially employment tax) on the spread between FMV and exercise price at each vest date.",
            "data": {"overdue": overdue, "pending": pending},
        }

    if pending:
        return {
            "status": "warning",
            "msg": f"{len(pending)} restricted stock grant(s) with 83(b) elections pending.",
            "action": "File 83(b) elections with the IRS NOW. Send certified mail with a return receipt. Keep a copy permanently. Deadline is strictly 30 days from grant date.",
            "data": {"overdue": overdue, "pending": pending},
        }

    return {
        "status": "ok",
        "msg": "All restricted stock grants have filed 83(b) elections on time.",
        "action": None,
        "data": {"overdue": [], "pending": []},
    }


# ════════════════════════════════════════════════════════════════
# CHECK 4 — QSBS §1202 ELIGIBILITY
# ════════════════════════════════════════════════════════════════

def check_qsbs(company) -> dict:
    """
    IRC §1202 — Qualified Small Business Stock.

    Exclusion: up to the GREATER of $10M or 10× adjusted basis per taxpayer
    per company, from federal capital gains tax. 100% exclusion for shares
    acquired after 9/27/2010.

    Requirements (all must be met):
    1. Domestic C-corporation (not S-corp, LLC, partnership)
    2. Gross assets ≤ $50M at time of issuance AND immediately after
    3. Taxpayer acquired stock at original issuance (not secondary)
    4. Active qualified trade or business (not professional services, finance,
       hospitality, farming, extractive industry)
    5. Held for more than 5 years
    6. Issued after August 10, 1993

    This check evaluates the company-level criteria. Holder-level criteria
    (original issuance, 5-year hold) are tracked per Security.
    """
    issues = []
    warnings = []

    # 1. Entity type check
    if company.entity_type != "c_corp":
        issues.append(f"Entity type is '{company.get_entity_type_display()}' — QSBS requires a C-corporation.")

    # 2. Incorporation date check
    if company.date_incorporated:
        qsbs_cutoff = date(1993, 8, 10)
        if company.date_incorporated <= qsbs_cutoff:
            issues.append(f"Company incorporated {company.date_incorporated} — before the Aug 10, 1993 QSBS cutoff.")

    # 3. Gross assets (approximate from post-money valuation of last round)
    from apps.equity.models import FundingRound
    last_round = FundingRound.objects.filter(company=company).order_by("-close_date").first()
    est_assets_cents = last_round.post_money_valuation if last_round and last_round.post_money_valuation else None
    THRESHOLD_50M_CENTS = 50_000_000 * 100

    if est_assets_cents and est_assets_cents > THRESHOLD_50M_CENTS:
        issues.append(f"Estimated gross assets (~${est_assets_cents/10000:,.0f}M based on last round post-money) exceed the $50M §1202 threshold.")
    elif est_assets_cents and est_assets_cents > THRESHOLD_50M_CENTS * 0.7:
        warnings.append(f"Estimated assets approaching the $50M §1202 threshold. Have a CPA confirm gross assets before issuing further shares.")

    # 4. Compute 5-year holding milestones per active security
    from apps.equity.models import Security
    common_securities = Security.objects.filter(
        company=company,
        share_class__cls_type__in=["common", "preferred"],
        status="active",
    ).select_related("stakeholder")

    today = date.today()
    holding_milestones = []
    for s in common_securities:
        five_year_date = s.grant_date + relativedelta(years=5)
        achieved = today >= five_year_date
        months_remaining = 0 if achieved else relativedelta(five_year_date, today).years * 12 + relativedelta(five_year_date, today).months
        holding_milestones.append({
            "holder": s.stakeholder.name,
            "grant_date": str(s.grant_date),
            "five_year_date": str(five_year_date),
            "achieved": achieved,
            "months_remaining": months_remaining,
            "cert": s.certificate_number,
        })

    if issues:
        return {
            "status": "critical",
            "msg": f"QSBS eligibility disqualified: {issues[0]}",
            "action": "Consult a tax attorney. QSBS benefits are likely unavailable for this company.",
            "data": {"issues": issues, "warnings": warnings, "milestones": holding_milestones, "est_assets_cents": est_assets_cents},
        }

    if warnings:
        return {
            "status": "warning",
            "msg": f"Company appears QSBS-eligible but has risk factors: {warnings[0]}",
            "action": "Engage a CPA or tax attorney to confirm eligibility before shareholders plan exits.",
            "data": {"issues": issues, "warnings": warnings, "milestones": holding_milestones, "est_assets_cents": est_assets_cents},
        }

    return {
        "status": "ok",
        "msg": f"Company appears QSBS-eligible: C-corp, incorporated after 1993, assets under $50M threshold. 5-year holding periods tracked per security.",
        "action": "Confirm eligibility with a tax attorney before any shareholder sells. Active business test and original issuance must also be verified.",
        "data": {"issues": [], "warnings": [], "milestones": holding_milestones, "est_assets_cents": est_assets_cents},
    }


# ════════════════════════════════════════════════════════════════
# CHECK 5 — FORM 3921 (ISO EXERCISES)
# ════════════════════════════════════════════════════════════════

def check_form_3921(company) -> dict:
    """
    IRC §6039 requires:
    - Companies to file Form 3921 with the IRS for each ISO exercise
    - Furnish a copy to the employee
    - Deadline: January 31 of the year FOLLOWING the exercise year
    - Penalty: $270–$550 per form for late filing after 30 days
              No ceiling for intentional disregard (can be $3,000+/form)

    Note: Form 3921 is NOT an income reporting form for the employee —
    it is an informational form that lets the IRS track AMT exposure.
    """
    from apps.equity.models import Exercise

    iso_exercises = Exercise.objects.filter(
        company=company,
        form_3921_required=True,
    ).select_related("security__stakeholder")

    today = date.today()
    overdue = []
    due_soon = []
    filed = []

    for e in iso_exercises:
        deadline = date(e.exercise_date.year + 1, 1, 31)
        if e.form_3921_filed:
            filed.append({
                "holder": e.security.stakeholder.name,
                "exercise_date": str(e.exercise_date),
                "shares": e.shares_exercised,
                "filed_at": str(e.form_3921_filed_at) if e.form_3921_filed_at else "unknown",
            })
            continue

        days_until = (deadline - today).days
        record = {
            "holder": e.security.stakeholder.name,
            "exercise_date": str(e.exercise_date),
            "shares": e.shares_exercised,
            "deadline": str(deadline),
            "exercise_id": str(e.id),
            "spread_dollars": e.spread_dollars,
        }

        if today > deadline:
            record["days_overdue"] = (today - deadline).days
            overdue.append(record)
        elif days_until <= 90:
            record["days_until"] = days_until
            due_soon.append(record)

    if overdue:
        total_penalty_estimate = len(overdue) * 270
        return {
            "status": "critical",
            "msg": f"{len(overdue)} ISO exercise(s) with overdue Form 3921 filings. Estimated minimum penalty: ${total_penalty_estimate:,}.",
            "action": f"File Form 3921 with the IRS and furnish copies to employees immediately. Engage a CPA. Penalty is $270–$550 per late form ({len(overdue)} overdue = minimum ${total_penalty_estimate:,}).",
            "data": {"overdue": overdue, "due_soon": due_soon, "filed": filed},
        }

    if due_soon:
        return {
            "status": "warning",
            "msg": f"{len(due_soon)} Form 3921 filing(s) due within 90 days.",
            "action": "File Form 3921 with the IRS by January 31. Both a machine-readable IRS copy and an employee copy are required.",
            "data": {"overdue": overdue, "due_soon": due_soon, "filed": filed},
        }

    return {
        "status": "ok",
        "msg": "No overdue Form 3921 filings. All ISO exercises are either filed or not yet due.",
        "action": None,
        "data": {"overdue": [], "due_soon": due_soon, "filed": filed},
    }


# ════════════════════════════════════════════════════════════════
# MASTER COMPLIANCE RUN
# ════════════════════════════════════════════════════════════════

def run_all_checks(company) -> dict:
    """Run all 5 compliance checks and return a consolidated result."""
    results = {
        "a409":  check_409a(company),
        "r701":  check_rule_701(company),
        "b83":   check_83b(company),
        "qsbs":  check_qsbs(company),
        "f3921": check_form_3921(company),
    }
    critical_count = sum(1 for r in results.values() if r["status"] == "critical")
    warning_count  = sum(1 for r in results.values() if r["status"] == "warning")
    return {
        "checks": results,
        "summary": {
            "critical": critical_count,
            "warning": warning_count,
            "ok": 5 - critical_count - warning_count,
            "overall": "critical" if critical_count else ("warning" if warning_count else "ok"),
        },
    }
