from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from assets.models import Asset, Category, Location
from .models import RepairTicket


class RepairModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
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

    def test_repair_ticket_str(self):
        ticket = RepairTicket.objects.create(
            asset=self.asset,
            issue_description="Broken screen",
            status="OPEN",
        )
        self.assertIn(str(ticket.id), str(ticket))
        self.assertIn("OPEN", str(ticket))

    def test_default_repair_cost_zero(self):
        ticket = RepairTicket.objects.create(
            asset=self.asset,
            issue_description="Broken screen",
            status="OPEN",
        )
        self.assertEqual(ticket.repair_cost, 0)

    def test_ordering(self):
        t1 = RepairTicket.objects.create(asset=self.asset, issue_description="Issue A", status="OPEN")
        t2 = RepairTicket.objects.create(asset=self.asset, issue_description="Issue B", status="OPEN")
        qs = RepairTicket.objects.all()
        self.assertEqual(qs.first(), t2)


class BaseRepairTest(TestCase):
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
        self.hr_asset = Asset.objects.create(
            asset_code="AST-002",
            asset_name="HR Asset",
            category=self.cat,
            brand="Dell",
            model_name="XPS",
            location=self.loc,
            department=self.dept2,
            serial_number="SN456",
            manufacturer="Dell",
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_ticket(self, asset=None, **kwargs):
        defaults = dict(
            asset=asset or self.asset,
            issue_description="Broken device",
            status="OPEN",
        )
        defaults.update(kwargs)
        return RepairTicket.objects.create(**defaults)


class RepairCRUDTests(BaseRepairTest):
    def test_list_unauthenticated(self):
        resp = self.client.get(reverse("repairticket-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_authenticated(self):
        self._create_ticket()
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_list_scoped_to_department(self):
        self._create_ticket(asset=self.asset)
        self._create_ticket(asset=self.hr_asset)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-list"))
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["asset_detail"]["asset_code"], "AST-001")

    def test_super_admin_sees_all(self):
        self._create_ticket(asset=self.asset)
        self._create_ticket(asset=self.hr_asset)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("repairticket-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_create_ticket(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("repairticket-list"), {
            "asset": self.asset.id,
            "issue_description": "Keyboard not working",
            "status": "OPEN",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["issue_description"], "Keyboard not working")

    def test_retrieve_ticket(self):
        ticket = self._create_ticket()
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-detail", args=[ticket.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("asset_detail", resp.data)
        self.assertEqual(resp.data["asset_detail"]["asset_code"], "AST-001")

    def test_update_ticket(self):
        ticket = self._create_ticket()
        self._auth(self.regular_user)
        resp = self.client.patch(reverse("repairticket-detail", args=[ticket.id]), {
            "status": "IN_PROGRESS",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "IN_PROGRESS")

    def test_delete_ticket(self):
        ticket = self._create_ticket()
        self._auth(self.regular_user)
        resp = self.client.delete(reverse("repairticket-detail", args=[ticket.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(RepairTicket.objects.filter(id=ticket.id).exists())


class RepairFilterTests(BaseRepairTest):
    def test_filter_by_status(self):
        self._create_ticket(status="OPEN")
        self._create_ticket(asset=self.asset, issue_description="Repair B", status="COMPLETED")
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-list"), {"status": "OPEN"})
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["status"], "OPEN")

    def test_search_by_asset_code(self):
        self._create_ticket(asset=self.asset)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-list"), {"search": "AST-001"})
        self.assertEqual(len(resp.data["results"]), 1)

    def test_search_by_issue_description(self):
        self._create_ticket(issue_description="Broken screen")
        self._auth(self.regular_user)
        resp = self.client.get(reverse("repairticket-list"), {"search": "Broken"})
        self.assertEqual(len(resp.data["results"]), 1)


class RepairTicketSerializerTests(BaseRepairTest):
    def test_serializer_includes_asset_detail(self):
        ticket = self._create_ticket()
        from repairs.serializers import RepairTicketSerializer
        serializer = RepairTicketSerializer(ticket)
        self.assertIn("asset_detail", serializer.data)
        self.assertEqual(serializer.data["asset_detail"]["asset_code"], "AST-001")
