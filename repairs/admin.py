# Makes RepairTicket manageable from Django's admin panel
from django.contrib import admin
from .models import RepairTicket


@admin.register(RepairTicket)
class RepairTicketAdmin(admin.ModelAdmin):
    list_display = ["id", "asset", "status", "repair_cost", "start_date", "completion_date"]
    list_filter = ["status"]
    search_fields = ["asset__asset_code", "asset__asset_name", "issue_description"]
