"""apps/documents/pdf.py

PDF generation using WeasyPrint (HTML → PDF).
Each document type has a Jinja2 HTML template that is rendered with
context data and then converted to a PDF byte stream.

Usage:
    pdf_bytes = generate_stock_certificate(security)
    with open("cert.pdf", "wb") as f:
        f.write(pdf_bytes)
"""
from __future__ import annotations
import io
from datetime import date
from pathlib import Path

from jinja2 import Environment, DictLoader
import weasyprint

# ════════════════════════════════════════════════════════════════
# HTML TEMPLATES
# ════════════════════════════════════════════════════════════════

STOCK_CERTIFICATE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter landscape;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      background: #fff;
      width: 100%;
      height: 100%;
    }
    .certificate {
      width: 11in;
      height: 8.5in;
      border: 12px double #1a1a5e;
      padding: 0.6in;
      position: relative;
    }
    .inner-border {
      border: 2px solid #8B7D3A;
      padding: 0.4in;
      height: 100%;
    }
    .corner-ornament {
      position: absolute;
      width: 60px;
      height: 60px;
      border: 3px solid #1a1a5e;
    }
    .corp-name {
      text-align: center;
      font-size: 26pt;
      font-weight: bold;
      letter-spacing: 3px;
      color: #1a1a5e;
      border-bottom: 2px solid #8B7D3A;
      padding-bottom: 10px;
      margin-bottom: 6px;
    }
    .state-line {
      text-align: center;
      font-size: 10pt;
      color: #555;
      margin-bottom: 20px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .cert-number {
      text-align: right;
      font-size: 10pt;
      color: #555;
      margin-bottom: 4px;
    }
    .share-class {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      color: #8B7D3A;
      margin-bottom: 24px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .body-text {
      font-size: 11pt;
      line-height: 2.0;
      margin-bottom: 24px;
      color: #222;
    }
    .shares-amount {
      font-size: 18pt;
      font-weight: bold;
      color: #1a1a5e;
    }
    .holder-name {
      font-size: 16pt;
      font-style: italic;
      text-decoration: underline;
      color: #1a1a5e;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
    }
    .signature-block {
      text-align: center;
      width: 200px;
    }
    .sig-line {
      border-top: 1px solid #333;
      margin-bottom: 4px;
      margin-top: 36px;
    }
    .sig-label {
      font-size: 9pt;
      color: #555;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .seal-area {
      text-align: center;
      width: 120px;
    }
    .seal-circle {
      width: 100px;
      height: 100px;
      border: 3px double #1a1a5e;
      border-radius: 50%;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      color: #1a1a5e;
      text-align: center;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .vesting-note {
      font-size: 8pt;
      color: #888;
      margin-top: 16px;
      border-top: 1px solid #ddd;
      padding-top: 8px;
    }
    .cusip { font-size: 9pt; color: #aaa; margin-top: 4px; }
  </style>
</head>
<body>
<div class="certificate">
  <div class="inner-border">
    <div class="cert-number">Certificate No. {{ cert_number }} | Issued: {{ grant_date }}</div>

    <div class="corp-name">{{ company_name }}</div>
    <div class="state-line">Incorporated under the laws of the State of {{ state }}</div>
    <div class="share-class">{{ share_class }} Stock</div>

    <div class="body-text">
      <em>This certifies that</em>
      <br>
      <span class="holder-name">{{ holder_name }}</span>
      <br>
      <em>is the registered holder of</em>
      <br>
      <span class="shares-amount">{{ shares_formatted }}</span>
      <em>&nbsp;({{ shares_words }}) fully paid and non-assessable shares of
      {{ share_class }} Stock of {{ company_name }}, a {{ state }} corporation,
      transferable only on the books of the Corporation by the holder hereof in
      person or by duly authorized attorney upon surrender of this Certificate
      properly endorsed.</em>
    </div>

    {% if vesting_note %}
    <div class="vesting-note">
      Subject to: {{ vesting_note }}. See Restricted Stock Purchase Agreement
      and Stock Restriction Agreement for details.
    </div>
    {% endif %}

    <div class="footer">
      <div class="signature-block">
        <div class="sig-line"></div>
        <div class="sig-label">Chief Executive Officer</div>
      </div>
      <div class="seal-area">
        <div class="seal-circle">CORPORATE<br>SEAL<br>{{ company_name[:12] }}</div>
      </div>
      <div class="signature-block">
        <div class="sig-line"></div>
        <div class="sig-label">Secretary</div>
      </div>
    </div>

    <div class="cusip">
      Price per Share at Issuance: ${{ price_per_share }} &nbsp;|&nbsp;
      Grant Date: {{ grant_date }} &nbsp;|&nbsp;
      Board Approval: {{ board_approval_date or "See Board Consent" }}
    </div>
  </div>
</div>
</body>
</html>
"""


OPTION_GRANT_LETTER_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: letter; margin: 1.1in 1.1in 1in 1.1in; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #222; line-height: 1.5; }
    .letterhead { border-bottom: 2px solid #1a1a5e; margin-bottom: 24px; padding-bottom: 12px; }
    .company-name { font-size: 18pt; font-weight: bold; color: #1a1a5e; }
    h1 { font-size: 13pt; color: #1a1a5e; margin: 20px 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
    .meta-table td { padding: 6px 8px; border: 1px solid #ddd; }
    .meta-table td:first-child { font-weight: bold; background: #f7f7f9; width: 40%; }
    .warning-box {
      background: #fff8e1;
      border-left: 4px solid #F59E0B;
      padding: 10px 14px;
      margin: 16px 0;
      font-size: 9.5pt;
    }
    .section { margin: 16px 0; }
    .sig-block { margin-top: 40px; }
    .sig-line { border-top: 1px solid #333; width: 200px; margin-top: 36px; margin-bottom: 4px; }
    p { margin: 10px 0; }
    .footer { font-size: 8pt; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 8px; }
  </style>
</head>
<body>
<div class="letterhead">
  <div class="company-name">{{ company_name }}</div>
  <div style="font-size:9pt;color:#888;">{{ company_state }} C-Corporation</div>
</div>

<div style="margin-bottom:16px;font-size:10pt;">
  <strong>Date:</strong> {{ grant_date }}<br>
  <strong>To:</strong> {{ holder_name }} &lt;{{ holder_email }}&gt;<br>
  <strong>Re:</strong> Notice of Stock Option Grant — {{ option_ref }}
</div>

<h1>Notice of Stock Option Grant</h1>

<p>We are pleased to inform you that the Board of Directors of <strong>{{ company_name }}</strong> has
approved a grant of stock options to you under the {{ company_name }} {{ plan_year }} Equity
Incentive Plan (the "Plan"). The details of your grant are set forth below.</p>

<table class="meta-table">
  <tr><td>Grantee</td><td>{{ holder_name }}</td></tr>
  <tr><td>Grant Date</td><td>{{ grant_date }}</td></tr>
  <tr><td>Option Type</td><td>{{ option_type }} ({{ option_type_long }})</td></tr>
  <tr><td>Number of Shares</td><td>{{ shares_formatted }} shares of Common Stock</td></tr>
  <tr><td>Exercise Price</td><td>${{ exercise_price }} per share</td></tr>
  <tr><td>Fair Market Value at Grant</td><td>${{ fmv_at_grant }} per share (§409A valuation, {{ val_date }})</td></tr>
  <tr><td>Expiration Date</td><td>{{ expiry_date }} (10 years from grant, subject to earlier termination)</td></tr>
  <tr><td>Vesting Schedule</td><td>{{ vesting_summary }}</td></tr>
  <tr><td>Acceleration</td><td>{{ acceleration }}</td></tr>
  <tr><td>Board Approval</td><td>{{ board_approval_date }}</td></tr>
</table>

<h1>Key Terms</h1>

<div class="section">
  <p><strong>Exercise Price.</strong> The exercise price of ${{ exercise_price }} per share equals the fair market value of the Company's Common Stock on the grant date, as determined by the Board of Directors in good faith reliance on the 409A valuation report dated {{ val_date }}.</p>

  <p><strong>Vesting.</strong> Your option vests over {{ vesting_months }} months, with a {{ cliff_months }}-month cliff. Subject to your continued service, {{ cliff_shares }} shares vest on {{ cliff_date }} (the "Cliff Date"), and the remaining shares vest in equal monthly installments of {{ monthly_vest }} shares thereafter, until fully vested on {{ full_vest_date }}.</p>

  <p><strong>Exercise.</strong> You may exercise your vested options by delivering written notice and payment of the aggregate exercise price (${{ exercise_price }} × shares exercised) to the Company's Secretary.</p>

  <p><strong>Termination.</strong> Options must be exercised within 90 days of termination of service (or 12 months for disability; 18 months for death), but in no event after the expiration date.</p>
</div>

{% if option_type == "ISO" %}
<div class="warning-box">
  <strong>ISO Tax Notice:</strong> This option is intended to qualify as an Incentive Stock Option under IRC §422. To preserve ISO treatment, you must not sell shares acquired upon exercise until the later of (i) two years from the grant date or (ii) one year from the exercise date. Early dispositions are "disqualifying dispositions" and will be taxed as ordinary income. Consult your tax advisor before exercising.
</div>
{% else %}
<div class="warning-box">
  <strong>NSO Tax Notice:</strong> This is a Non-Qualified Stock Option. Upon exercise, the spread between the exercise price and the fair market value at exercise date will be treated as ordinary income and subject to income and employment taxes. The Company will withhold applicable taxes. Consult your tax advisor.
</div>
{% endif %}

<div class="section">
  <p>This option grant is subject to the full terms of the Plan and your Option Agreement, which you will receive separately. By accepting this grant, you acknowledge that you have read and understood these materials.</p>
</div>

<div class="sig-block">
  <p>On behalf of the Board of Directors,</p>
  <div class="sig-line"></div>
  <p><strong>Chief Executive Officer</strong><br>{{ company_name }}</p>
</div>

<div class="footer">
  {{ option_ref }} | Generated {{ today }} | CONFIDENTIAL — For recipient only.<br>
  This document is not a tax, legal, or financial advisory. Consult qualified advisors.
</div>
</body>
</html>
"""

# ════════════════════════════════════════════════════════════════
# RENDERING HELPERS
# ════════════════════════════════════════════════════════════════

def _render_html(template_str: str, context: dict) -> str:
    env = Environment(loader=DictLoader({"tmpl": template_str}))
    return env.get_template("tmpl").render(**context)


def _html_to_pdf(html: str) -> bytes:
    buf = io.BytesIO()
    weasyprint.HTML(string=html).write_pdf(buf)
    return buf.getvalue()


def _num_to_words(n: int) -> str:
    """Convert integer to English word representation (simplified, up to millions)."""
    ones = ["","one","two","three","four","five","six","seven","eight","nine",
            "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen",
            "seventeen","eighteen","nineteen"]
    tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]

    if n == 0: return "zero"
    if n < 0: return "negative " + _num_to_words(-n)
    if n < 20: return ones[n]
    if n < 100: return tens[n//10] + ("-" + ones[n%10] if n%10 else "")
    if n < 1000: return ones[n//100] + " hundred" + (" " + _num_to_words(n%100) if n%100 else "")
    if n < 1_000_000: return _num_to_words(n//1000) + " thousand" + (" " + _num_to_words(n%1000) if n%1000 else "")
    if n < 1_000_000_000: return _num_to_words(n//1_000_000) + " million" + (" " + _num_to_words(n%1_000_000) if n%1_000_000 else "")
    return str(n)  # fallback


# ════════════════════════════════════════════════════════════════
# PUBLIC GENERATORS
# ════════════════════════════════════════════════════════════════

def generate_stock_certificate(security) -> bytes:
    """
    Generate a PDF stock certificate for a given Security instance.
    Returns raw PDF bytes — caller is responsible for saving to S3/disk.
    """
    from dateutil.relativedelta import relativedelta

    vs = security.vesting_schedule
    if vs:
        vesting_note = (
            f"Vesting: {vs.total_months}-month schedule, "
            f"{vs.cliff_months}-month cliff, commencing {vs.start_date}"
        )
    else:
        vesting_note = None

    pps_dollars = (security.price_per_share or 0) / 1_000_000
    shares = security.shares_issued

    context = {
        "cert_number":       security.certificate_number or "DRAFT",
        "company_name":      security.company.name,
        "state":             security.company.state_of_inc,
        "share_class":       security.share_class.name,
        "holder_name":       security.stakeholder.name,
        "shares_formatted":  f"{shares:,}",
        "shares_words":      _num_to_words(shares).title(),
        "price_per_share":   f"{pps_dollars:.4f}",
        "grant_date":        str(security.grant_date),
        "board_approval_date": str(security.board_approval_date) if security.board_approval_date else "",
        "vesting_note":      vesting_note,
    }

    html = _render_html(STOCK_CERTIFICATE_HTML, context)
    return _html_to_pdf(html)


def generate_option_grant_letter(security) -> bytes:
    """
    Generate a PDF option grant notification letter for an option Security.
    """
    from dateutil.relativedelta import relativedelta

    vs = security.vesting_schedule
    cliff_date = (vs.start_date + relativedelta(months=vs.cliff_months)) if vs else None
    full_vest_date = (vs.start_date + relativedelta(months=vs.total_months)) if vs else None
    cliff_shares = vs.vested_shares(security.shares_issued, as_of=cliff_date) if vs and cliff_date else 0
    monthly_vest = (security.shares_issued - cliff_shares) // max(1, (vs.total_months - vs.cliff_months)) if vs else 0

    pps = (security.price_per_share or 0) / 1_000_000
    fmv = (security.company.latest_409a_pps or 0) / 1_000_000
    is_iso = "ISO" in security.share_class.name

    context = {
        "company_name":     security.company.name,
        "company_state":    security.company.state_of_inc,
        "holder_name":      security.stakeholder.name,
        "holder_email":     security.stakeholder.email or "—",
        "grant_date":       str(security.grant_date),
        "option_ref":       security.certificate_number or str(security.id)[:8].upper(),
        "option_type":      "ISO" if is_iso else "NSO",
        "option_type_long": "Incentive Stock Option" if is_iso else "Non-Qualified Stock Option",
        "shares_formatted": f"{security.shares_issued:,}",
        "exercise_price":   f"{pps:.4f}",
        "fmv_at_grant":     f"{fmv:.4f}",
        "val_date":         str(security.company.latest_409a_date) if security.company.latest_409a_date else "N/A",
        "expiry_date":      str(security.expiry_date) if security.expiry_date else "—",
        "vesting_summary":  f"{vs.total_months}-month schedule, {vs.cliff_months}-month cliff" if vs else "Immediate",
        "vesting_months":   vs.total_months if vs else 0,
        "cliff_months":     vs.cliff_months if vs else 0,
        "cliff_shares":     f"{cliff_shares:,}",
        "cliff_date":       str(cliff_date) if cliff_date else "—",
        "monthly_vest":     f"{monthly_vest:,}",
        "full_vest_date":   str(full_vest_date) if full_vest_date else "—",
        "acceleration":     vs.acceleration or "None",
        "board_approval_date": str(security.board_approval_date) if security.board_approval_date else "See Board Consent",
        "plan_year":        str(security.company.date_incorporated.year) if security.company.date_incorporated else "",
        "today":            str(date.today()),
    }

    html = _render_html(OPTION_GRANT_LETTER_HTML, context)
    return _html_to_pdf(html)
