from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, latest_kpi, download_pdf_token, download_excel_token

router = DefaultRouter()
router.register('', ReportViewSet, basename='reports')

urlpatterns = [
    path('kpi/', latest_kpi, name='kpi'),
    path('download/<uuid:token>/', download_pdf_token, name='download-pdf'),
    path('download-excel/<uuid:token>/', download_excel_token, name='download-excel'),
    path('', include(router.urls)),
]
