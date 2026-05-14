from rest_framework import serializers
from .models import Report


class ReportListSerializer(serializers.ModelSerializer):
    pdf_data = serializers.SerializerMethodField()
    excel_data = serializers.SerializerMethodField()
    chart_data = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = '__all__'

    def get_pdf_data(self, obj):
        return obj.pdf_data is not None

    def get_excel_data(self, obj):
        return obj.excel_data is not None

    def get_chart_data(self, obj):
        return obj.chart_data is not None and not obj.chart_cleared


class ReportDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'
