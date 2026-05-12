# Converts RepairTicket data to JSON for the API
# Includes a nested asset_detail so the frontend doesn't need extra lookups
from rest_framework import serializers
from .models import RepairTicket
from assets.models import Asset
from assets.serializers import AssetSerializer


class RepairTicketSerializer(serializers.ModelSerializer):
    # Full asset object nested inside the ticket response
    asset_detail = AssetSerializer(source="asset", read_only=True)

    class Meta:
        model = RepairTicket
        fields = "__all__"
