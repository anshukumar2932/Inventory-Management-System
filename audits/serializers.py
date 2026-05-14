from rest_framework import serializers
from .models import AuditSession, AuditEntry


class AuditEntrySerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.asset_code", read_only=True)
    asset_name = serializers.CharField(source="asset.asset_name", read_only=True)

    class Meta:
        model = AuditEntry
        fields = '__all__'


class AuditSessionSerializer(serializers.ModelSerializer):
    entries = AuditEntrySerializer(many=True, read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)
    verified_count = serializers.SerializerMethodField()
    total_assets = serializers.SerializerMethodField()

    class Meta:
        model = AuditSession
        fields = '__all__'

    def get_verified_count(self, obj):
        return obj.entries.count()

    def get_total_assets(self, obj):
        from assets.models import Asset
        return Asset.objects.filter(department=obj.department).count()
