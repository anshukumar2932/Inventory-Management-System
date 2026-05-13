import uuid
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse, Http404

from .models import Report
from .serializers import ReportListSerializer, ReportDetailSerializer
from .services import generate_weekly_report


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
        report = generate_weekly_report(user=user)
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
    from .services import collect_kpi_metrics
    metrics = collect_kpi_metrics(user=request.user)
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
