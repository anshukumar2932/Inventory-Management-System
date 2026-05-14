from unittest.mock import patch
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from assets.models import Asset, Category, Location
from .models import ProcurementRequest


class BaseProcurementTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.dept2 = Department.objects.create(department_name="HR", code="HR")
        self.super_admin = User.objects.create_user(
            username="admin", password="admin1234", role="SUPER_ADMIN",
            department=self.dept, email="admin@example.com",
        )
        self.dept_admin = User.objects.create_user(
            username="deptadmin", password="dept1234", role="DEPARTMENT_ADMIN",
            department=self.dept, email="deptadmin@example.com",
        )
        self.manager = User.objects.create_user(
            username="manager", password="mgr12345", role="MANAGER",
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

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_procurement(self, user=None, dept=None):
        user = user or self.regular_user
        dept = dept or self.dept
        return ProcurementRequest.objects.create(
            department=dept,
            requested_by=user,
            remarks="Need new equipment",
        )


class ProcurementModelTests(BaseProcurementTest):
    def test_request_number_auto_generated(self):
        pr = self._create_procurement()
        self.assertIsNotNone(pr.request_number)
        self.assertTrue(pr.request_number.startswith("PR-"))

    def test_approval_token_auto_generated(self):
        pr = self._create_procurement()
        self.assertIsNotNone(pr.approval_token)

    def test_default_status_pending(self):
        pr = self._create_procurement()
        self.assertEqual(pr.approval_status, "PENDING")

    def test_str(self):
        pr = self._create_procurement()
        self.assertEqual(str(pr), pr.request_number)


class ProcurementCreateTests(BaseProcurementTest):
    def _create(self, user):
        self._auth(user)
        return self.client.post(reverse("procurementrequest-list"), {
            "department": self.dept.id,
            "remarks": "Need laptops",
            "requested_by": user.id,
            "request_number": "PR-TEST",
        })

    def test_authenticated_user_can_create(self):
        resp = self._create(self.regular_user)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["requested_by_name"], "user")

    def test_unauthenticated_cannot_create(self):
        resp = self.client.post(reverse("procurementrequest-list"), {
            "department": self.dept.id,
            "remarks": "Need laptops",
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_sets_requested_by(self):
        resp = self._create(self.manager)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["requested_by_name"], "manager")


class ProcurementListTests(BaseProcurementTest):
    def test_super_admin_sees_all(self):
        self._create_procurement(dept=self.dept)
        self._create_procurement(user=self.hr_user, dept=self.dept2)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("procurementrequest-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_user_sees_only_own_department(self):
        self._create_procurement(dept=self.dept)
        self._create_procurement(user=self.hr_user, dept=self.dept2)
        self._auth(self.manager)
        resp = self.client.get(reverse("procurementrequest-list"))
        for r in resp.data["results"]:
            self.assertEqual(r["department_name"], "IT")


class ProcurementPendingHistoryTests(BaseProcurementTest):
    def test_pending_only_super_admin(self):
        self._auth(self.manager)
        resp = self.client.get(reverse("procurementrequest-pending"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_pending_returns_only_pending(self):
        pr1 = self._create_procurement()
        pr2 = self._create_procurement()
        pr2.approval_status = "APPROVED"
        pr2.save()
        self._auth(self.super_admin)
        resp = self.client.get(reverse("procurementrequest-pending"))
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["id"], pr1.id)

    def test_pending_department_admin_sees_own_department_only(self):
        pr1 = self._create_procurement(dept=self.dept)
        self._create_procurement(user=self.hr_user, dept=self.dept2)
        self._auth(self.dept_admin)
        resp = self.client.get(reverse("procurementrequest-pending"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["id"], pr1.id)

    def test_history_only_super_admin(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("procurementrequest-history"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_history_excludes_pending(self):
        pr1 = self._create_procurement()
        pr2 = self._create_procurement()
        pr2.approval_status = "APPROVED"
        pr2.save()
        self._auth(self.super_admin)
        resp = self.client.get(reverse("procurementrequest-history"))
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["id"], pr2.id)


class ProcurementApproveRejectTests(BaseProcurementTest):
    def test_approve_only_super_admin(self):
        pr = self._create_procurement()
        self._auth(self.manager)
        resp = self.client.post(reverse("procurementrequest-approve", args=[pr.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_approve_success(self):
        pr = self._create_procurement()
        self._auth(self.super_admin)
        resp = self.client.post(reverse("procurementrequest-approve", args=[pr.id]), {"remarks": "Approved"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pr.refresh_from_db()
        self.assertEqual(pr.approval_status, "APPROVED")
        self.assertEqual(pr.approved_by, self.super_admin)
        self.assertIsNotNone(pr.approved_at)

    def test_department_admin_can_approve_own_department(self):
        pr = self._create_procurement()
        self._auth(self.dept_admin)
        resp = self.client.post(reverse("procurementrequest-approve", args=[pr.id]), {"remarks": "Approved"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pr.refresh_from_db()
        self.assertEqual(pr.approval_status, "APPROVED")
        self.assertEqual(pr.approved_by, self.dept_admin)

    def test_approve_non_pending_fails(self):
        pr = self._create_procurement()
        pr.approval_status = "APPROVED"
        pr.save()
        self._auth(self.super_admin)
        resp = self.client.post(reverse("procurementrequest-approve", args=[pr.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_success(self):
        pr = self._create_procurement()
        self._auth(self.super_admin)
        resp = self.client.post(reverse("procurementrequest-reject", args=[pr.id]), {"remarks": "Not needed"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        pr.refresh_from_db()
        self.assertEqual(pr.approval_status, "REJECTED")
        self.assertIsNotNone(pr.rejected_at)

    def test_reject_non_pending_fails(self):
        pr = self._create_procurement()
        pr.approval_status = "REJECTED"
        pr.save()
        self._auth(self.super_admin)
        resp = self.client.post(reverse("procurementrequest-reject", args=[pr.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ProcurementEmailTokenTests(BaseProcurementTest):
    def setUp(self):
        super().setUp()
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")
        self.pr = self._create_procurement()
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
            procurement_request=self.pr,
        )

    def test_approve_email_invalid_token(self):
        self._auth(self.super_admin)
        resp = self.client.get("/api/v1/procurements/approve-email/00000000-0000-0000-0000-000000000000/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_approve_email_success(self):
        resp = self.client.get(f"/api/v1/procurements/approve-email/{self.pr.approval_token}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.pr.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(self.pr.approval_status, "APPROVED")
        self.assertEqual(self.asset.approval_status, "APPROVED")
        self.assertEqual(self.asset.status, "ACTIVE")

    def test_approve_email_already_processed(self):
        self.client.get(f"/api/v1/procurements/approve-email/{self.pr.approval_token}/")
        resp = self.client.get(f"/api/v1/procurements/approve-email/{self.pr.approval_token}/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_email_success(self):
        resp = self.client.get(f"/api/v1/procurements/reject-email/{self.pr.approval_token}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.pr.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(self.pr.approval_status, "REJECTED")
        self.assertEqual(self.asset.approval_status, "REJECTED")
        self.assertEqual(self.asset.status, "BLOCKED")

    def test_reject_email_invalid_token(self):
        resp = self.client.get("/api/v1/procurements/reject-email/00000000-0000-0000-0000-000000000000/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class ProcurementSignalTests(BaseProcurementTest):
    def setUp(self):
        super().setUp()
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")
        self.pr = self._create_procurement()
        self.asset = Asset.objects.create(
            asset_code="AST-002",
            asset_name="Dell Laptop",
            category=self.cat,
            brand="Dell",
            model_name="XPS",
            location=self.loc,
            department=self.dept,
            serial_number="SN456",
            manufacturer="Dell",
            procurement_request=self.pr,
            approval_status="PENDING",
            status="BLOCKED",
        )

    @patch("notifications.tasks.create_notification_task.delay")
    def test_approve_via_signal_updates_assets(self, mock_notify):
        self.pr.approval_status = "APPROVED"
        self.pr.save()
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.approval_status, "APPROVED")
        self.assertEqual(self.asset.status, "ACTIVE")
        mock_notify.assert_called_once()

    @patch("notifications.tasks.create_notification_task.delay")
    def test_reject_via_signal_updates_assets(self, mock_notify):
        self.pr.approval_status = "REJECTED"
        self.pr.remarks = "Budget constraints"
        self.pr.save()
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.approval_status, "REJECTED")
        self.assertEqual(self.asset.status, "BLOCKED")
        mock_notify.assert_called_once()
        call_args = mock_notify.call_args[1]
        self.assertIn("Budget constraints", call_args["message"])


class ProcurementSerializerTests(BaseProcurementTest):
    def test_serializer_read_only_fields(self):
        pr = self._create_procurement()
        from procurement.serializers import ProcurementRequestSerializer
        serializer = ProcurementRequestSerializer(pr)
        self.assertEqual(serializer.data["requested_by_name"], "user")
        self.assertEqual(serializer.data["department_name"], "IT")
        self.assertEqual(serializer.data["asset_count"], 0)
