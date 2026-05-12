# API endpoints for the repair ticket workflow
# Supports full CRUD, search by asset/issue, and filter by status
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import RepairTicket
from .serializers import RepairTicketSerializer


class RepairViewSet(viewsets.ModelViewSet):
    # select_related prevents N+1 queries when accessing asset details
    queryset = RepairTicket.objects.select_related("asset").all()
    serializer_class = RepairTicketSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    # Search across the asset's code, name, and the issue description
    search_fields = [
        "asset__asset_code",
        "asset__asset_name",
        "issue_description",
    ]
    filterset_fields = ["status"]
    ordering_fields = ["start_date", "completion_date", "repair_cost"]
    ordering = ["-start_date"]
