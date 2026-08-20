from django.contrib import admin
# core/admin.py — all models here are abstract, nothing to register

from apps.core.models import Cashflow
@admin.register(Cashflow)
class CashflowAdmin(admin.ModelAdmin):
    list_display = ("date","type","label","amount_cents","fund")
    list_filter  = ("type","fund")
    date_hierarchy = "date"
