from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['title', 'report_type', 'generated_by', 'is_scheduled', 'chart_cleared', 'created_at']
    list_filter = ['report_type', 'is_scheduled', 'chart_cleared']
