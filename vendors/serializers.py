from rest_framework import serializers
from .models import Vendor


class VendorSerializer(serializers.ModelSerializer):
    vendor_category_name = serializers.CharField(source="vendor_category.name", read_only=True, allow_null=True)
    service_names = serializers.SerializerMethodField()
    category_names = serializers.SerializerMethodField()
    company_names = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = "__all__"

    def get_service_names(self, obj):
        return [s.service_name for s in obj.services.all()]

    def get_category_names(self, obj):
        return [c.name for c in obj.supported_categories.all()]

    def get_company_names(self, obj):
        return [c.company_name for c in obj.served_companies.all()]
