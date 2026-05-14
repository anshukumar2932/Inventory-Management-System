from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from assets.models import Asset
from .models import AuditSession, AuditEntry
from .serializers import AuditSessionSerializer, AuditEntrySerializer


class AuditSessionViewSet(viewsets.ModelViewSet):
    queryset = AuditSession.objects.prefetch_related('entries__asset').all()
    serializer_class = AuditSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AuditSession.objects.prefetch_related('entries__asset').all()
        user = self.request.user
        if user.role == "SUPER_ADMIN":
            return qs
        if user.department:
            return qs.filter(department=user.department)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['POST'])
    def scan(self, request, pk=None):
        session = self.get_object()
        if session.status != 'OPEN':
            return Response({'error': 'Audit session is closed'}, status=400)

        barcode = request.data.get('barcode')
        if not barcode:
            return Response({'error': 'barcode required'}, status=400)

        try:
            asset = Asset.objects.select_related('location').get(barcode=barcode)
        except Asset.DoesNotExist:
            return Response({'found': False, 'error': 'Asset not found'}, status=404)

        if AuditEntry.objects.filter(audit_session=session, asset=asset).exists():
            return Response({'found': True, 'duplicate': True, 'asset': {'id': asset.id, 'asset_code': asset.asset_code, 'asset_name': asset.asset_name}})

        entry = AuditEntry.objects.create(
            audit_session=session,
            asset=asset,
            scanned_by=request.user,
            expected_location=asset.location,
            actual_location=asset.location,
        )

        return Response({
            'found': True,
            'duplicate': False,
            'entry_id': entry.id,
            'verified_count': session.entries.count(),
            'asset': {
                'id': asset.id,
                'asset_code': asset.asset_code,
                'asset_name': asset.asset_name,
                'expected_location': asset.location.name if asset.location else None,
            },
        })

    @action(detail=True, methods=['POST'])
    def complete(self, request, pk=None):
        session = self.get_object()
        if session.status != 'OPEN':
            return Response({'error': 'Already completed'}, status=400)
        session.status = 'COMPLETED'
        session.completed_at = timezone.now()
        session.save()
        serializer = self.get_serializer(session)
        return Response(serializer.data)
