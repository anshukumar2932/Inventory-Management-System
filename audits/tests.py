from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from assets.models import Asset, Category, Location
from .models import AuditSession, AuditEntry


class AuditModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")

    def test_audit_session_default_status_open(self):
        session = AuditSession.objects.create(department=self.dept)
        self.assertEqual(session.status, "OPEN")

    def test_audit_entry_default_not_mismatch(self):
        session = AuditSession.objects.create(department=self.dept)
        cat = Category.objects.create(name="Test")
        loc = Location.objects.create(name="Loc")
        asset = Asset.objects.create(
            asset_code="AST-TEST",
            asset_name="Test Asset",
            category=cat,
            brand="B",
            model_name="M",
            location=loc,
            department=self.dept,
            serial_number="SN-TEST",
            manufacturer="M",
        )
        entry = AuditEntry.objects.create(audit_session=session, asset=asset)
        self.assertFalse(entry.is_mismatch)


class BaseAuditTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.dept2 = Department.objects.create(department_name="HR", code="HR")
        self.super_admin = User.objects.create_user(
            username="admin", password="admin1234", role="SUPER_ADMIN",
            department=self.dept,
        )
        self.dept_admin = User.objects.create_user(
            username="deptadmin", password="dept1234", role="DEPARTMENT_ADMIN",
            department=self.dept,
        )
        self.regular_user = User.objects.create_user(
            username="user", password="user1234", role="USER",
            department=self.dept,
        )
        self.hr_user = User.objects.create_user(
            username="hruser", password="hr123456", role="USER",
            department=self.dept2,
        )
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")
        self.asset = Asset.objects.create(
            asset_code="AST-001",
            asset_name="MacBook",
            category=self.cat,
            brand="Apple",
            model_name="M3",
            location=self.loc,
            department=self.dept,
            serial_number="SN123",
            manufacturer="Apple",
        )
        self.asset2 = Asset.objects.create(
            asset_code="AST-002",
            asset_name="Dell Laptop",
            category=self.cat,
            brand="Dell",
            model_name="XPS",
            location=self.loc,
            department=self.dept,
            serial_number="SN456",
            manufacturer="Dell",
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_session(self, user=None, dept=None, status="OPEN"):
        user = user or self.regular_user
        dept = dept or self.dept
        return AuditSession.objects.create(
            department=dept,
            created_by=user,
            status=status,
        )


class AuditSessionCRUDTests(BaseAuditTest):
    def test_list_unauthenticated(self):
        resp = self.client.get(reverse("audit-sessions-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_scoped_to_department(self):
        self._create_session(dept=self.dept)
        self._create_session(dept=self.dept2)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("audit-sessions-list"))
        self.assertEqual(len(resp.data["results"]), 1)

    def test_super_admin_sees_all(self):
        self._create_session(dept=self.dept)
        self._create_session(dept=self.dept2)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("audit-sessions-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_create_session(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-list"), {
            "department": self.dept.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "OPEN")

    def test_create_sets_created_by(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-list"), {
            "department": self.dept.id,
        })
        session = AuditSession.objects.get(id=resp.data["id"])
        self.assertEqual(session.created_by, self.regular_user)

    def test_retrieve_session(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.get(reverse("audit-sessions-detail", args=[session.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AuditScanTests(BaseAuditTest):
    def test_scan_requires_barcode(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scan_closed_session_fails(self):
        session = self._create_session(status="COMPLETED")
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": self.asset.barcode})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scan_invalid_barcode(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": "NONEXISTENT"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_scan_success(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": self.asset.barcode})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["found"])
        self.assertFalse(resp.data["duplicate"])
        self.assertIsNotNone(resp.data["entry_id"])

    def test_scan_duplicate_detection(self):
        session = self._create_session()
        self._auth(self.regular_user)
        self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": self.asset.barcode})
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": self.asset.barcode})
        self.assertTrue(resp.data["duplicate"])

    def test_scan_creates_entry_with_expected_location(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-scan", args=[session.id]), {"barcode": self.asset.barcode})
        entry = AuditEntry.objects.get(id=resp.data["entry_id"])
        self.assertEqual(entry.expected_location, self.loc)
        self.assertEqual(entry.actual_location, self.loc)
        self.assertEqual(entry.scanned_by, self.regular_user)


class AuditCompleteTests(BaseAuditTest):
    def test_complete_open_session(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-complete", args=[session.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.status, "COMPLETED")
        self.assertIsNotNone(session.completed_at)

    def test_complete_already_completed_fails(self):
        session = self._create_session(status="COMPLETED")
        self._auth(self.regular_user)
        resp = self.client.post(reverse("audit-sessions-complete", args=[session.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class AuditSerializerTests(BaseAuditTest):
    def test_session_serializer_has_department_name(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.get(reverse("audit-sessions-detail", args=[session.id]))
        self.assertEqual(resp.data["department_name"], "IT")

    def test_session_serializer_verified_count(self):
        session = self._create_session()
        AuditEntry.objects.create(audit_session=session, asset=self.asset)
        AuditEntry.objects.create(audit_session=session, asset=self.asset2)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("audit-sessions-detail", args=[session.id]))
        self.assertEqual(resp.data["verified_count"], 2)

    def test_session_serializer_total_assets(self):
        session = self._create_session()
        self._auth(self.regular_user)
        resp = self.client.get(reverse("audit-sessions-detail", args=[session.id]))
        self.assertEqual(resp.data["total_assets"], 2)
