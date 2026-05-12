from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from assets.models import Asset
from assets.views import IsAuth, IsAdmin
from notifications.models import Notification
from .models import ProcurementRequest
from .serializers import ProcurementRequestSerializer


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role.role_name in ("ADMIN", "INVENTORY MANAGER")


class ProcurementViewSet(viewsets.ModelViewSet):
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer
    permission_classes = [IsAuth]

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = user.role.role_name
        if role == "ADMIN":
            return qs
        return qs.filter(requested_by=user)

    @action(detail=False, methods=["GET"], permission_classes=[IsAdmin])
    def pending(self, request):
        qs = ProcurementRequest.objects.filter(approval_status="PENDING")
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["GET"], permission_classes=[IsAdmin])
    def history(self, request):
        qs = ProcurementRequest.objects.exclude(approval_status="PENDING")
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["POST"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        procurement = self.get_object()
        if procurement.approval_status != "PENDING":
            return Response({"error": "Request is not pending"}, status=status.HTTP_400_BAD_REQUEST)

        remarks = request.data.get("remarks", "")
        procurement.approval_status = "APPROVED"
        procurement.remarks = remarks
        procurement.approved_by = request.user
        procurement.approved_at = timezone.now()
        procurement.save()

        procurement.assets.all().update(
            approval_status="APPROVED",
            status="ACTIVE"
        )

        Notification.objects.create(
            user=procurement.requested_by,
            title="Procurement Approved",
            message=f"Your procurement request {procurement.request_number} has been approved.",
        )

        return Response({"message": "Procurement approved successfully"})

    @action(detail=True, methods=["POST"], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        procurement = self.get_object()
        if procurement.approval_status != "PENDING":
            return Response({"error": "Request is not pending"}, status=status.HTTP_400_BAD_REQUEST)

        remarks = request.data.get("remarks", "")
        procurement.approval_status = "REJECTED"
        procurement.remarks = remarks
        procurement.rejected_at = timezone.now()
        procurement.save()

        procurement.assets.all().update(
            approval_status="REJECTED",
            status="BLOCKED"
        )

        Notification.objects.create(
            user=procurement.requested_by,
            title="Procurement Rejected",
            message=f"Your procurement request {procurement.request_number} has been rejected. Remarks: {remarks}",
        )

        return Response({"message": "Procurement rejected"})


@api_view(["GET"])
@permission_classes([IsAuth])
def approve_email(request, token):
    try:
        procurement = ProcurementRequest.objects.get(approval_token=token)
    except ProcurementRequest.DoesNotExist:
        return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)

    if procurement.approval_status != "PENDING":
        return Response({"error": "Request is not pending"}, status=status.HTTP_400_BAD_REQUEST)

    procurement.approval_status = "APPROVED"
    procurement.approved_at = timezone.now()
    procurement.save()

    procurement.assets.all().update(
        approval_status="APPROVED",
        status="ACTIVE"
    )

    return Response({"message": "Procurement approved successfully"})


@api_view(["GET"])
@permission_classes([IsAuth])
def reject_email(request, token):
    try:
        procurement = ProcurementRequest.objects.get(approval_token=token)
    except ProcurementRequest.DoesNotExist:
        return Response({"error": "Invalid token"}, status=status.HTTP_404_NOT_FOUND)

    if procurement.approval_status != "PENDING":
        return Response({"error": "Request is not pending"}, status=status.HTTP_400_BAD_REQUEST)

    procurement.approval_status = "REJECTED"
    procurement.rejected_at = timezone.now()
    procurement.save()

    procurement.assets.all().update(
        approval_status="REJECTED",
        status="BLOCKED"
    )

    return Response({"message": "Procurement rejected"})
