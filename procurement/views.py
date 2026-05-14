from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from assets.views.permissions import IsAuth, IsSuperAdmin
from .models import ProcurementRequest
from .serializers import ProcurementRequestSerializer


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "SUPER_ADMIN"


class IsAuth(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

class IsDeptAdmin(BasePermission):
     def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ("SUPER_ADMIN", "DEPARTMENT_ADMIN"))

class IsManager(BasePermission):
     def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "MANAGER")

class IsSuperAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ("SUPER_ADMIN", "DEPARTMENT_ADMIN", "MANAGER")

class ProcurementViewSet(viewsets.ModelViewSet):
    queryset = ProcurementRequest.objects.all()
    serializer_class = ProcurementRequestSerializer
    permission_classes = [IsAuth]

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "SUPER_ADMIN":
            return qs
        if user.department:
            return qs.filter(department=user.department)
        return qs.filter(requested_by=user)

    @action(detail=False, methods=["GET"], permission_classes=[IsDeptAdmin])
    def pending(self, request):
        qs = ProcurementRequest.objects.filter(approval_status="PENDING")
        if request.user.role != "SUPER_ADMIN":
            qs = qs.filter(department=request.user.department)
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["GET"], permission_classes=[IsDeptAdmin])
    def history(self, request):
        qs = ProcurementRequest.objects.exclude(approval_status="PENDING")
        if request.user.role != "SUPER_ADMIN":
            qs = qs.filter(department=request.user.department)
        page = self.paginate_queryset(qs)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["POST"], permission_classes=[IsDeptAdmin])
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
        procurement.save()
        return Response({"message": "Procurement approved successfully"})

    @action(detail=True, methods=["POST"], permission_classes=[IsDeptAdmin])
    def reject(self, request, pk=None):
        procurement = self.get_object()
        if procurement.approval_status != "PENDING":
            return Response({"error": "Request is not pending"}, status=status.HTTP_400_BAD_REQUEST)
        remarks = request.data.get("remarks", "")
        procurement.approval_status = "REJECTED"
        procurement.remarks = remarks
        procurement.rejected_at = timezone.now()
        procurement.save()
        procurement.save()
        return Response({"message": "Procurement rejected"})


@api_view(["GET"])
@permission_classes([])
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
    procurement.assets.all().update(approval_status="APPROVED", status="ACTIVE")
    return Response({"message": "Procurement approved successfully"})


@api_view(["GET"])
@permission_classes([])
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
    procurement.assets.all().update(approval_status="REJECTED", status="BLOCKED")
    return Response({"message": "Procurement rejected"})
