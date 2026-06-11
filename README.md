# CapTable — Production Backend

Django + PostgreSQL + Celery backend for the cap table management platform.

## Architecture

```
captable/
├── captable/              Django project (settings, urls, celery)
├── apps/
│   ├── core/              Abstract base models (UUID PKs, tenant isolation)
│   ├── accounts/          Custom User model, CompanyMembership roles
│   ├── equity/            Cap table core: Company, ShareClass, Security, VestingSchedule
│   │   ├── models.py      All equity models — immutable financial records
│   │   ├── compliance.py  5 compliance engines (409A, 701, 83b, QSBS, 3921)
│   │   ├── views.py       REST API — cap table, waterfall, scenario modeling
│   │   └── tasks.py       Celery: nightly compliance checks, vesting alerts
│   └── documents/
│       ├── pdf.py         WeasyPrint HTML→PDF (certificates + grant letters)
│       ├── docusign.py    DocuSign JWT auth + envelope creation + webhook
│       ├── views.py       Document REST API + DocuSign webhook receiver
│       └── tasks.py       Async PDF generation + S3 upload
├── templates/             PDF HTML templates (Jinja2)
├── docker-compose.yml     Postgres + Redis + API + Celery worker + Beat
└── Dockerfile             Python 3.12 + WeasyPrint system deps
```

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY, DocuSign credentials, AWS keys, SendGrid key
```

### 2. Run with Docker Compose

```bash
docker compose up --build
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **Django API** on `http://localhost:8000`
- **Celery worker** (queues: default, pdf, compliance)
- **Celery Beat** (scheduled tasks)

### 3. Create superuser and seed data

```bash
docker compose exec api python manage.py createsuperuser
docker compose exec api python manage.py shell
```

```python
# In the shell, create a test company:
from apps.accounts.models import User, CompanyMembership
from apps.equity.models import Company, ShareClass

u = User.objects.get(email="your@email.com")
co = Company.objects.create(
    name="Acme Corp, Inc.",
    state_of_inc="Delaware",
    entity_type="c_corp",
    date_incorporated="2022-03-15",
    latest_409a_pps=420000,       # $0.42 in microdollars
    latest_409a_date="2024-06-01",
    latest_409a_value=420000000,   # $4.2M in cents
)
CompanyMembership.objects.create(user=u, company=co, role="owner")
```

## REST API Reference

### Authentication
```
POST /api/auth/token/          → { access, refresh }
POST /api/auth/token/refresh/  → { access }
```
All other endpoints: `Authorization: Bearer <access_token>`

### Companies
```
GET  /api/v1/equity/companies/
POST /api/v1/equity/companies/

GET  /api/v1/equity/companies/{id}/cap_table_summary/
GET  /api/v1/equity/companies/{id}/compliance/
POST /api/v1/equity/companies/{id}/update_409a/
GET  /api/v1/equity/companies/{id}/waterfall/?exit_value=25000000
GET  /api/v1/equity/companies/{id}/scenario_model/?raise_amount=5000000&pre_money=15000000
```

### Securities
```
GET  /api/v1/equity/companies/{co_id}/securities/
POST /api/v1/equity/companies/{co_id}/securities/
POST /api/v1/equity/companies/{co_id}/securities/{id}/cancel/
POST /api/v1/equity/companies/{co_id}/securities/{id}/file_83b/
```

### Documents (PDF + DocuSign)
```
POST /api/v1/documents/companies/{co_id}/documents/generate_certificate/
POST /api/v1/documents/companies/{co_id}/documents/generate_grant_letter/
POST /api/v1/documents/companies/{co_id}/documents/{id}/send_for_signature/
GET  /api/v1/documents/companies/{co_id}/documents/{id}/download/
POST /api/v1/documents/docusign/webhook/
```

## Key Design Decisions

### Multi-tenant security
Every equity model has a `company` FK. **Never** query without scoping to a company:
```python
# Correct — always scope by company:
Security.objects.filter(company=request.company, status="active")

# Wrong — would return ALL companies' data:
Security.objects.filter(status="active")
```

### Financial precision
All monetary values stored as integers:
- **Dollars** → cents (`$4.2M` = `420_000_000`)
- **Price per share** → microdollars (`$0.42` = `420_000`)
- Never store price as `float` — use `Decimal` or `int`

### Immutable audit trail
- `auditlog` middleware logs every model change to `LogEntry`
- `ComplianceRecord` is append-only — never update, always create new
- Security records are never deleted — only cancelled via state transition
- Exercises are immutable — corrections create a new exercise + cancellation note

### DocuSign setup
1. Create a DocuSign developer account at `developers.docusign.com`
2. Create an app → get Integration Key
3. Generate RSA keypair → upload public key to DocuSign, save private key as `docusign_private.pem`
4. Set `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_USER_ID`
5. Grant consent: `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature+impersonation&client_id=<KEY>&redirect_uri=https://your-domain/callback`
6. Configure Connect webhook in DocuSign admin → point to `/api/v1/documents/docusign/webhook/`

### Celery Beat scheduled tasks
Configure in Django admin → Periodic Tasks:
| Task | Schedule |
|------|----------|
| `apps.equity.tasks.run_compliance_checks_all_companies` | Daily at 06:00 UTC |
| `apps.equity.tasks.check_upcoming_409a_expirations` | Weekly |
| `apps.equity.tasks.check_vesting_cliff_events` | Daily |

## Running tests

```bash
docker compose exec api pytest apps/ -v --cov=apps --cov-report=term-missing
```

## Production deployment

1. Set `DJANGO_SETTINGS_MODULE=captable.settings.production`
2. Set `DEBUG=False`, real `SECRET_KEY`, `ALLOWED_HOSTS`
3. Use RDS PostgreSQL with Multi-AZ and automated backups
4. Use ElastiCache Redis (cluster mode)
5. Set `AWS_ACCESS_KEY_ID` etc. for S3 document storage
6. Deploy API + worker + beat as separate ECS tasks or K8s pods
7. Put API behind an ALB with HTTPS termination
8. Configure Sentry DSN for error monitoring
