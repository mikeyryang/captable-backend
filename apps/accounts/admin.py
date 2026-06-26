from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, CompanyMembership

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ("email","full_name","is_staff","is_active","date_joined")
    search_fields  = ("email","full_name","username")
    list_filter    = ("is_staff","is_active","is_superuser")
    ordering       = ("-date_joined",)
    fieldsets = (
        (None,          {"fields": ("email","username","password")}),
        ("Personal",    {"fields": ("full_name","phone")}),
        ("Permissions", {"fields": ("is_active","is_staff","is_superuser","groups","user_permissions")}),
        ("Dates",       {"fields": ("last_login","date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email","username","full_name","password1","password2")}),
    )

@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display   = ("user","company","role","invited_at","accepted_at")
    search_fields  = ("user__email","company__name")
    list_filter    = ("role","company")
    raw_id_fields  = ("user","company")
