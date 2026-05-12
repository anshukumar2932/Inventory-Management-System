from rest_framework import serializers
from .models import ProcurementRequest


class ProcurementRequestSerializer(serializers.ModelSerializer):

    requested_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    asset_count = serializers.SerializerMethodField()

    class Meta:
        model = ProcurementRequest
        fields = "__all__"

    def get_requested_by_name(self, obj):
        return obj.requested_by.username if obj.requested_by else ""

    def get_department_name(self, obj):
        return obj.department.department_name if obj.department else ""

    def get_asset_count(self, obj):
        return obj.assets.count()
