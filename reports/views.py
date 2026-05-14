import uuid
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from celery.result import AsyncResult

from .models import Report
from .serializers import ReportListSerializer, ReportDetailSerializer
from .tasks import generate_report_task, send_report_email_task
from .services import collect_kpi_metrics


class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Report.objects.none()
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Report.objects.all()
        user = self.request.user
        if user.role == "SUPER_ADMIN":
            return qs
        if user.department:
            return qs.filter(generated_by__department=user.department)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return ReportListSerializer
        return ReportDetailSerializer

    @action(detail=False, methods=['POST'])
    def generate(self, request):
        user = request.user
        report = Report.objects.create(
            title=f"Weekly Executive Report — {__import__('datetime').datetime.now().strftime('%B %d, %Y %I:%M %p')}",
            report_type='WEEKLY',
            status='GENERATING',
            generated_by=user,
            department=user.department if user and user.department else None,
            is_scheduled=False,
        )
        task = generate_report_task.delay(user_id=user.id, report_id=report.id)
        report.task_id = task.id
        report.save(update_fields=['task_id'])
        return Response(
            {"report_id": report.id, "task_id": task.id},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['GET'])
    def status(self, request, pk=None):
        report = self.get_object()
        task_id = report.task_id
        task_status = None
        if task_id:
            result = AsyncResult(task_id)
            task_status = result.state

        return Response({
            "report_id": report.id,
            "report_status": report.status,
            "task_id": task_id,
            "task_status": task_status,
            "title": report.title,
            "created_at": report.created_at,
        })

    @action(detail=True, methods=['POST'])
    def send_email(self, request, pk=None):
        report = self.get_object()
        task = send_report_email_task.delay(report_id=report.id)
        return Response(
            {"task_id": task.id, "message": "Email sending initiated"},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['GET'])
    def download_pdf(self, request, pk=None):
        report = self.get_object()
        if not report.pdf_data:
            return Response({'error': 'No PDF data'}, status=404)
        return HttpResponse(report.pdf_data, content_type='application/pdf')

    @action(detail=True, methods=['GET'])
    def download_excel(self, request, pk=None):
        report = self.get_object()
        if not report.excel_data:
            return Response({'error': 'No Excel data'}, status=404)
        return HttpResponse(
            report.excel_data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

    @action(detail=True, methods=['GET'])
    def download_chart(self, request, pk=None):
        report = self.get_object()
        if report.chart_expired or not report.chart_data:
            return Response({'error': 'Chart expired or not available'}, status=404)
        return HttpResponse(report.chart_data, content_type='image/png')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def latest_kpi(request):
    from django.core.cache import caches
    report_cache = caches['reports']
    user = request.user
    cache_key = f"kpi:{user.id}:{user.role}"
    cached = report_cache.get(cache_key)
    if cached is not None:
        return Response(cached)
    from .services import collect_kpi_metrics
    metrics = collect_kpi_metrics(user=user)
    report_cache.set(cache_key, metrics, 3600)
    return Response(metrics)


def _serve_report_by_token(token, content_type, field):
    try:
        uid = uuid.UUID(str(token))
        report = Report.objects.get(download_token=uid)
    except (ValueError, Report.DoesNotExist):
        raise Http404("Report not found")
    data = getattr(report, field, None)
    if not data:
        raise Http404("No data available")
    return HttpResponse(data, content_type=content_type)


@api_view(['GET'])
@permission_classes([])
def download_pdf_token(request, token):
    return _serve_report_by_token(token, 'application/pdf', 'pdf_data')


@api_view(['GET'])
@permission_classes([])
def download_excel_token(request, token):
    return _serve_report_by_token(
        token,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'excel_data',
    )
