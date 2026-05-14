from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from .models import Report
from .serializers import ReportListSerializer, ReportDetailSerializer


class ReportModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.user = User.objects.create_user(
            username="admin", password="admin1234", role="SUPER_ADMIN",
            department=self.dept,
        )

    def test_report_default_status_ready(self):
        report = Report.objects.create(
            title="Test Report",
            report_type="WEEKLY",
            generated_by=self.user,
        )
        self.assertEqual(report.status, "READY")

    def test_report_download_token_auto_generated(self):
        report = Report.objects.create(
            title="Test Report",
            report_type="WEEKLY",
            generated_by=self.user,
        )
        self.assertIsNotNone(report.download_token)

    def test_chart_expired_property(self):
        report = Report.objects.create(
            title="Test Report",
            report_type="WEEKLY",
            generated_by=self.user,
            chart_cleared=True,
        )
        self.assertTrue(report.chart_expired)

    def test_clear_chart(self):
        report = Report.objects.create(
            title="Test Report",
            report_type="WEEKLY",
            generated_by=self.user,
            chart_data=b"some_data",
        )
        report.clear_chart()
        self.assertIsNone(report.chart_data)
        self.assertTrue(report.chart_cleared)

    def test_str(self):
        report = Report.objects.create(
            title="Test Report",
            report_type="WEEKLY",
            generated_by=self.user,
        )
        self.assertIn("Weekly Executive Report", str(report))


class BaseReportTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.dept2 = Department.objects.create(department_name="HR", code="HR")
        self.super_admin = User.objects.create_user(
            username="admin", password="admin1234", role="SUPER_ADMIN",
            department=self.dept,
        )
        self.manager = User.objects.create_user(
            username="manager", password="mgr12345", role="MANAGER",
            department=self.dept,
        )
        self.hr_user = User.objects.create_user(
            username="hruser", password="hr123456", role="USER",
            department=self.dept2,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_report(self, user=None, **kwargs):
        defaults = dict(
            title="Weekly Report",
            report_type="WEEKLY",
            status="READY",
            generated_by=user or self.super_admin,
            department=getattr(user or self.super_admin, "department", None),
        )
        defaults.update(kwargs)
        return Report.objects.create(**defaults)


class ReportListTests(BaseReportTest):
    def test_list_unauthenticated(self):
        resp = self.client.get(reverse("reports-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_super_admin_sees_all(self):
        self._create_report(user=self.super_admin)
        self._create_report(user=self.hr_user)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_list_scoped_by_department(self):
        self._create_report(user=self.super_admin)
        self._create_report(user=self.hr_user)
        self._auth(self.manager)
        resp = self.client.get(reverse("reports-list"))
        self.assertEqual(len(resp.data["results"]), 1)

    def test_list_serializer_returns_booleans(self):
        report = self._create_report(
            pdf_data=b"pdf",
            excel_data=b"excel",
            chart_data=b"chart",
        )
        serializer = ReportListSerializer(report)
        self.assertIsInstance(serializer.data["pdf_data"], bool)
        self.assertIsInstance(serializer.data["excel_data"], bool)

    def test_detail_serializer_returns_full_data(self):
        report = self._create_report()
        serializer = ReportDetailSerializer(report)
        self.assertIn("title", serializer.data)
        self.assertIn("report_type", serializer.data)


class ReportGenerateTests(BaseReportTest):
    @patch("reports.views.generate_report_task.delay")
    def test_generate_report(self, mock_task):
        mock_task.return_value.id = "mock-task-id"
        self._auth(self.super_admin)
        resp = self.client.post(reverse("reports-generate"))
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("report_id", resp.data)
        self.assertIn("task_id", resp.data)
        self.assertTrue(Report.objects.filter(id=resp.data["report_id"]).exists())

    @patch("reports.views.generate_report_task.delay")
    def test_generate_report_unauthenticated(self, mock_task):
        resp = self.client.post(reverse("reports-generate"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_report(self):
        report = self._create_report()
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-detail", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class ReportStatusTests(BaseReportTest):
    def test_status_endpoint(self):
        report = self._create_report(task_id="some-task")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-status", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["report_id"], report.id)
        self.assertEqual(resp.data["report_status"], "READY")
        self.assertIn("task_status", resp.data)


class ReportDownloadTests(BaseReportTest):
    def test_download_pdf_no_data(self):
        report = self._create_report()
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-download-pdf", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_pdf_success(self):
        report = self._create_report(pdf_data=b"%PDF-1.4 mock data")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-download-pdf", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_download_excel_success(self):
        report = self._create_report(excel_data=b"mock excel")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-download-excel", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheet", resp["Content-Type"])

    def test_download_chart_expired(self):
        report = self._create_report(chart_data=b"png", chart_cleared=True)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-download-chart", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_chart_success(self):
        report = self._create_report(chart_data=b"png data")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("reports-download-chart", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "image/png")

    @patch("reports.views.send_report_email_task.delay")
    def test_send_email(self, mock_task):
        mock_task.return_value.id = "email-task-id"
        report = self._create_report()
        self._auth(self.super_admin)
        resp = self.client.post(reverse("reports-send-email", args=[report.id]))
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("task_id", resp.data)


class ReportTokenDownloadTests(BaseReportTest):
    def test_download_pdf_by_token_no_auth(self):
        report = self._create_report(pdf_data=b"%PDF data")
        resp = self.client.get(reverse("download-pdf", args=[report.download_token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_download_pdf_by_token_invalid(self):
        resp = self.client.get(
            reverse("download-pdf", args=["00000000-0000-0000-0000-000000000000"])
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_download_excel_by_token(self):
        report = self._create_report(excel_data=b"excel data")
        resp = self.client.get(reverse("download-excel", args=[report.download_token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheet", resp["Content-Type"])

    def test_download_excel_by_token_no_data(self):
        report = self._create_report()
        resp = self.client.get(reverse("download-excel", args=[report.download_token]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class ReportKPITests(BaseReportTest):
    @override_settings(CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
        'reports': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
    })
    def test_kpi_endpoint(self):
        self._auth(self.super_admin)
        resp = self.client.get(reverse("kpi"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("total_assets", resp.data)
        self.assertIn("active_assets", resp.data)

    @override_settings(CACHES={
        'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
        'reports': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'},
    })
    def test_kpi_returns_cached_data(self):
        self._auth(self.super_admin)
        resp1 = self.client.get(reverse("kpi"))
        resp2 = self.client.get(reverse("kpi"))
        self.assertEqual(resp1.data, resp2.data)
