from unittest.mock import patch, MagicMock
from io import BytesIO
import struct
import zlib

from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Department
from assets.models import (
    Asset, Category, Location, Document, ServiceType,
    Availability, AssetService as AssetServiceModel,
    AssetAssignment, AsyncBarcodeJob,
)
from assets.serializers import (
    AssetSerializer, AssetListSerializer, AssetDetailSerializer,
    CategorySerializer, LocationSerializer, DocumentSerializer,
    ServiceTypeSerializer, AvailabilitySerializer, AssetServiceSerializer,
)
from assets.services.asset_service import AssetService
from assets.services.barcode_service import BarcodeService
from assets.services.upload_service import BulkUploadService
from assets.services.send_email import (
    build_report_email,
    send_report_email,
    send_new_asset_email,
    build_procurement_approval_email,
    send_procurement_approval_email,
)
from procurement.models import ProcurementRequest
from vendors.models import Vendor

User = get_user_model()


def _extract_html(msg):
    alt_part = msg.get_payload()[0]
    for part in alt_part.get_payload():
        if part.get_content_type() == 'text/html':
            return part.get_payload()
    return ''


def _minimal_png():
    def _chunk(ctype, data):
        c = ctype + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    raw = b'\x00\xff\x00\x00'
    idat = zlib.compress(raw)
    return b'\x89PNG\r\n\x1a\n' + _chunk(b'IHDR', ihdr) + _chunk(b'IDAT', idat) + _chunk(b'IEND', b'')


# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------

class CategoryModelTests(TestCase):
    def test_str(self):
        cat = Category.objects.create(name="Electronics")
        self.assertEqual(str(cat), "Electronics")

    def test_ordering(self):
        Category.objects.create(name="Appliances")
        Category.objects.create(name="Electronics")
        qs = Category.objects.all()
        self.assertEqual(qs[0].name, "Appliances")

    def test_name_unique(self):
        Category.objects.create(name="Electronics")
        with self.assertRaises(Exception):
            Category.objects.create(name="Electronics")


class LocationModelTests(TestCase):
    def setUp(self):
        self.loc = Location.objects.create(
            name="Main Office", building="A", floor="1", room="101",
        )

    def test_str(self):
        self.assertEqual(str(self.loc), "Main Office")

    def test_sub_location_default(self):
        self.assertEqual(self.loc.sub_location, '')

    def test_fields(self):
        self.assertEqual(self.loc.building, "A")
        self.assertEqual(self.loc.floor, "1")
        self.assertEqual(self.loc.room, "101")


class DocumentModelTests(TestCase):
    def setUp(self):
        self.doc = Document.objects.create(
            file_name="test.pdf", content_type="application/pdf",
            file_size=1024, file_data=b"%PDF-1.4",
        )

    def test_str(self):
        self.assertEqual(str(self.doc), "test.pdf")

    def test_ordering(self):
        Document.objects.create(
            file_name="new.pdf", content_type="application/pdf",
            file_size=512, file_data=b"%PDF",
        )
        qs = Document.objects.all()
        self.assertEqual(qs.first().file_name, "new.pdf")


class AssetModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")

    def test_create_asset_auto_generates_barcode(self):
        asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MacBook",
            category=self.cat, brand="Apple", model_name="M3",
            location=self.loc, department=self.dept,
            serial_number="SN123", manufacturer="Apple",
        )
        self.assertIsNotNone(asset.barcode)
        self.assertEqual(len(asset.barcode), 20)

    def test_default_status_blocked(self):
        asset = Asset.objects.create(
            asset_code="AST-002", asset_name="Dell Laptop",
            category=self.cat, brand="Dell", model_name="XPS",
            location=self.loc, department=self.dept,
            serial_number="SN456", manufacturer="Dell",
        )
        self.assertEqual(asset.status, "BLOCKED")
        self.assertEqual(asset.approval_status, "PENDING")

    def test_approval_token_auto_generated(self):
        asset = Asset.objects.create(
            asset_code="AST-TOKEN", asset_name="Token Test",
            category=self.cat, brand="Test", model_name="T1",
            location=self.loc, department=self.dept,
            serial_number="SN-TOKEN", manufacturer="Mfg",
        )
        self.assertIsNotNone(asset.approval_token)
        self.assertEqual(len(str(asset.approval_token)), 36)

    def test_str(self):
        asset = Asset.objects.create(
            asset_code="AST-003", asset_name="ThinkPad",
            category=self.cat, brand="Lenovo", model_name="T14",
            location=self.loc, department=self.dept,
            serial_number="SN789", manufacturer="Lenovo",
        )
        self.assertEqual(str(asset), "AST-003")

    def test_unique_asset_code(self):
        Asset.objects.create(
            asset_code="AST-001", asset_name="MacBook",
            category=self.cat, brand="Apple", model_name="M3",
            location=self.loc, department=self.dept,
            serial_number="SN123", manufacturer="Apple",
        )
        with self.assertRaises(Exception):
            Asset.objects.create(
                asset_code="AST-001", asset_name="MacBook Pro",
                category=self.cat, brand="Apple", model_name="M3 Pro",
                location=self.loc, department=self.dept,
                serial_number="SN999", manufacturer="Apple",
            )


class AssetAssignmentModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")
        self.asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MacBook",
            category=self.cat, brand="Apple", model_name="M3",
            location=self.loc, department=self.dept,
            serial_number="SN123", manufacturer="Apple",
        )

    def test_create_assignment(self):
        assn = AssetAssignment.objects.create(
            asset_id=self.asset, department=self.dept, remark="Initial assignment",
        )
        self.assertIn("AST-001", str(assn))
        self.assertIsNone(assn.return_date)

    def test_remark_default(self):
        assn = AssetAssignment.objects.create(
            asset_id=self.asset, department=self.dept,
        )
        self.assertEqual(assn.remark, '')


class ServiceTypeModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")

    def test_str(self):
        st = ServiceType.objects.create(name="Warranty", department=self.dept)
        self.assertEqual(str(st), "Warranty")

    def test_global_default(self):
        st = ServiceType.objects.create(name="Global Service")
        self.assertFalse(st.is_global)

    def test_unique_constraint(self):
        ServiceType.objects.create(name="Warranty", department=self.dept)
        with self.assertRaises(Exception):
            ServiceType.objects.create(name="Warranty", department=self.dept)


class AvailabilityModelTests(TestCase):
    def test_str(self):
        av = Availability.objects.create(name="24/7")
        self.assertEqual(str(av), "24/7")

    def test_name_unique(self):
        Availability.objects.create(name="24/7")
        with self.assertRaises(Exception):
            Availability.objects.create(name="24/7")


class AssetServiceModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")
        self.asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MacBook",
            category=self.cat, brand="Apple", model_name="M3",
            location=self.loc, department=self.dept,
            serial_number="SN123", manufacturer="Apple",
        )
        self.st = ServiceType.objects.create(name="Warranty")

    def test_str(self):
        from datetime import date
        asv = AssetServiceModel.objects.create(
            asset=self.asset, service_type=self.st,
            start_date=date(2024, 1, 1), end_date=date(2025, 1, 1),
        )
        self.assertIn("AST-001", str(asv))

    def test_default_status(self):
        from datetime import date
        asv = AssetServiceModel.objects.create(
            asset=self.asset, service_type=self.st,
            start_date=date(2024, 1, 1), end_date=date(2025, 1, 1),
        )
        self.assertEqual(asv.status, "ACTIVE")
        self.assertEqual(asv.renewal_reminder_days, 30)


class AsyncBarcodeJobModelTests(TestCase):
    def test_default_status(self):
        job = AsyncBarcodeJob.objects.create()
        self.assertEqual(job.status, "PENDING")
        self.assertEqual(job.asset_count, 0)

    def test_str(self):
        job = AsyncBarcodeJob.objects.create(asset_count=5)
        self.assertIsNotNone(job.id)


# ---------------------------------------------------------------------------
# Serializer Tests
# ---------------------------------------------------------------------------

class CategorySerializerTests(TestCase):
    def test_serialize(self):
        cat = Category.objects.create(name="Electronics")
        s = CategorySerializer(cat)
        self.assertEqual(s.data["name"], "Electronics")

    def test_deserialize(self):
        s = CategorySerializer(data={"name": "Furniture"})
        self.assertTrue(s.is_valid())
        obj = s.save()
        self.assertEqual(obj.name, "Furniture")


class LocationSerializerTests(TestCase):
    def test_serialize(self):
        loc = Location.objects.create(name="Office", building="B1")
        s = LocationSerializer(loc)
        self.assertEqual(s.data["name"], "Office")

    def test_deserialize(self):
        s = LocationSerializer(data={"name": "Warehouse", "building": "W1", "floor": "G", "room": "1"})
        self.assertTrue(s.is_valid())


class DocumentSerializerTests(TestCase):
    def test_serialize(self):
        doc = Document.objects.create(
            file_name="doc.pdf", content_type="application/pdf",
            file_size=100, file_data=b"data",
        )
        s = DocumentSerializer(doc)
        self.assertEqual(s.data["file_name"], "doc.pdf")


class ServiceTypeSerializerTests(TestCase):
    def test_serialize(self):
        st = ServiceType.objects.create(name="Warranty")
        s = ServiceTypeSerializer(st)
        self.assertEqual(s.data["name"], "Warranty")


class AvailabilitySerializerTests(TestCase):
    def test_serialize(self):
        av = Availability.objects.create(name="Business Hours")
        s = AvailabilitySerializer(av)
        self.assertEqual(s.data["name"], "Business Hours")


class AssetServiceSerializerTests(TestCase):
    def test_read_only_fields(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Office")
        asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MBP",
            category=cat, brand="Apple", model_name="M3",
            location=loc, department=dept,
            serial_number="SN1", manufacturer="Apple",
        )
        st = ServiceType.objects.create(name="Warranty")
        from datetime import date
        asv = AssetServiceModel.objects.create(
            asset=asset, service_type=st,
            start_date=date(2024, 1, 1), end_date=date(2025, 1, 1),
        )
        s = AssetServiceSerializer(asv)
        self.assertEqual(s.data["service_type_name"], "Warranty")


class AssetListSerializerTests(TestCase):
    def test_only_list_fields(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Office")
        asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MBP",
            category=cat, brand="Apple", model_name="M3",
            location=loc, department=dept,
            serial_number="SN1", manufacturer="Apple",
        )
        s = AssetListSerializer(asset)
        self.assertIn("asset_code", s.data)
        self.assertIn("asset_name", s.data)

    def test_includes_only_active_service_names(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Office")
        warranty = ServiceType.objects.create(name="Warranty")
        insurance = ServiceType.objects.create(name="Insurance")
        asset = Asset.objects.create(
            asset_code="AST-002", asset_name="ThinkPad",
            category=cat, brand="Lenovo", model_name="T14",
            location=loc, department=dept,
            serial_number="SN2", manufacturer="Lenovo",
        )
        AssetService.objects.create(
            asset=asset,
            service_type=warranty,
            start_date=date(2024, 1, 1),
            end_date=date(2026, 1, 1),
            status="ACTIVE",
        )
        AssetService.objects.create(
            asset=asset,
            service_type=insurance,
            start_date=date(2024, 1, 1),
            end_date=date(2025, 6, 1),
            status="EXPIRED",
        )

        s = AssetListSerializer(asset)

        self.assertEqual(s.data["active_services"], ["Warranty"])


class AssetDetailSerializerTests(TestCase):
    def test_includes_resolved_names(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Main Office")
        asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MBP",
            category=cat, brand="Apple", model_name="M3",
            location=loc, department=dept,
            serial_number="SN1", manufacturer="Apple",
        )
        s = AssetDetailSerializer(asset)
        self.assertEqual(s.data["category_name"], "Electronics")
        self.assertEqual(s.data["location_name"], "Main Office")
        self.assertEqual(s.data["department_name"], "IT")


class AssetSerializerTests(TestCase):
    def test_full_serializer(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Office")
        data = {
            "asset_code": "AST-010", "asset_name": "Test Asset",
            "category": cat.id, "brand": "TestBrand", "model_name": "T1",
            "location": loc.id, "department": dept.id,
            "serial_number": "SN-TEST", "manufacturer": "TestMfg",
        }
        s = AssetSerializer(data=data)
        self.assertTrue(s.is_valid())
        asset = s.save()
        self.assertEqual(asset.asset_code, "AST-010")

    def test_validation_required_fields(self):
        s = AssetSerializer(data={})
        self.assertFalse(s.is_valid())
        self.assertIn("asset_code", s.errors)
        self.assertIn("asset_name", s.errors)


# ---------------------------------------------------------------------------
# Base Test Class for API Tests
# ---------------------------------------------------------------------------

class BaseAssetAPITest(TestCase):
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
        self.cat = Category.objects.create(name="Electronics")
        self.loc = Location.objects.create(name="Main Office")

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_asset(self, dept=None, **kwargs):
        dept = dept or self.dept
        defaults = dict(
            asset_code="AST-001", asset_name="MacBook",
            category=self.cat, brand="Apple", model_name="M3",
            location=self.loc, department=dept,
            serial_number="SN123", manufacturer="Apple",
        )
        defaults.update(kwargs)
        return Asset.objects.create(**defaults)


# ---------------------------------------------------------------------------
# Asset ViewSet Tests
# ---------------------------------------------------------------------------

class AssetViewSetListTests(BaseAssetAPITest):
    def test_unauthenticated(self):
        resp = self.client.get(reverse("asset-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_super_admin_sees_all(self):
        self._create_asset(asset_code="AST-001", dept=self.dept)
        self._create_asset(asset_code="AST-002", dept=self.dept2)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_user_sees_only_own_department(self):
        self._create_asset(asset_code="AST-001", dept=self.dept)
        self._create_asset(asset_code="AST-002", dept=self.dept2)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("asset-list"))
        for r in resp.data["results"]:
            self.assertEqual(r["department"], self.dept.id)

    def test_search_by_asset_name(self):
        self._create_asset(asset_code="AST-001", asset_name="MacBook Pro")
        self._create_asset(asset_code="AST-002", asset_name="Dell XPS")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-list"), {"search": "MacBook"})
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["asset_name"], "MacBook Pro")

    def test_filter_by_status(self):
        self._create_asset(asset_code="AST-001", status="ACTIVE")
        self._create_asset(asset_code="AST-002", status="REPAIR")
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-list"), {"status": "ACTIVE"})
        for r in resp.data["results"]:
            self.assertEqual(r["status"], "ACTIVE")


class AssetViewSetCreateTests(BaseAssetAPITest):
    def _create_payload(self):
        return {
            "asset_code": "AST-NEW", "asset_name": "New Asset",
            "category": self.cat.id, "brand": "Brand", "model_name": "M1",
            "location": self.loc.id, "department": self.dept.id,
            "serial_number": "SN-NEW", "manufacturer": "Mfg",
        }

    def test_unauthenticated_cannot_create(self):
        resp = self.client.post(reverse("asset-list"), self._create_payload())
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_cannot_create(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-list"), self._create_payload())
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_create(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-list"), self._create_payload())
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_sets_pending_and_blocked(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-list"), self._create_payload())
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        asset = Asset.objects.get(asset_code="AST-NEW")
        self.assertEqual(asset.approval_status, "PENDING")
        self.assertEqual(asset.status, "BLOCKED")

    @patch("assets.services.send_email.send_new_asset_email")
    def test_create_triggers_approval_email(self, mock_email):
        self._auth(self.manager)
        self.client.post(reverse("asset-list"), self._create_payload())
        asset = Asset.objects.get(asset_code="AST-NEW")
        mock_email.assert_called_once()
        qs_arg = mock_email.call_args[0][0]
        self.assertEqual(qs_arg.first(), asset)
        self.assertEqual(mock_email.call_args[0][1], self.dept)


class AssetViewSetUpdateTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()

    def test_user_cannot_update(self):
        self._auth(self.regular_user)
        resp = self.client.patch(reverse("asset-detail", args=[self.asset.id]), {"asset_name": "Hacked"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_update(self):
        self._auth(self.manager)
        resp = self.client.patch(reverse("asset-detail", args=[self.asset.id]), {"asset_name": "Updated"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.asset_name, "Updated")

    def test_manager_cannot_change_status(self):
        self._auth(self.manager)
        resp = self.client.patch(reverse("asset-detail", args=[self.asset.id]), {"status": "ACTIVE"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_change_status(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("asset-detail", args=[self.asset.id]), {"status": "ACTIVE"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.status, "ACTIVE")


class AssetViewSetDeleteTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()

    def test_user_cannot_delete(self):
        self._auth(self.regular_user)
        resp = self.client.delete(reverse("asset-detail", args=[self.asset.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_delete(self):
        self._auth(self.manager)
        resp = self.client.delete(reverse("asset-detail", args=[self.asset.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)


class AssetViewSetRetrieveTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()

    def test_retrieve_uses_detail_serializer(self):
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-detail", args=[self.asset.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("category_name", resp.data)


class AssetViewSetAddActionTests(BaseAssetAPITest):
    def test_add_creates_asset(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-add"), {
            "asset_code": "AST-ADD", "asset_name": "Added Asset",
            "category": self.cat.id, "brand": "B", "model_name": "M",
            "location": self.loc.id, "department": self.dept.id,
            "serial_number": "SN-ADD", "manufacturer": "Mfg",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["success"])
        self.assertTrue(Asset.objects.filter(asset_code="AST-ADD").exists())

    def test_add_accessible_by_any_authenticated_user(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-add"), {"asset_name": "Test"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("assets.services.send_email.send_new_asset_email")
    def test_add_triggers_approval_email(self, mock_email):
        self._auth(self.manager)
        self.client.post(reverse("asset-add"), {
            "asset_code": "AST-ADD-EML",
            "asset_name": "Email Test",
            "category": self.cat.id,
            "brand": "B",
            "model_name": "M",
            "location": self.loc.id,
            "department": self.dept.id,
            "serial_number": "SN-ADD-EML",
            "manufacturer": "Mfg",
        })
        asset = Asset.objects.get(asset_code="AST-ADD-EML")
        mock_email.assert_called_once()
        qs_arg = mock_email.call_args[0][0]
        self.assertEqual(qs_arg.first(), asset)
        self.assertEqual(mock_email.call_args[0][1], self.dept)

    @patch("assets.services.send_email.send_new_asset_email")
    def test_add_sets_pending_and_blocked(self, mock_email):
        self._auth(self.manager)
        self.client.post(reverse("asset-add"), {
            "asset_code": "AST-ADD-PND",
            "asset_name": "Pending Test",
            "category": self.cat.id,
            "brand": "B",
            "model_name": "M",
            "location": self.loc.id,
            "department": self.dept.id,
            "serial_number": "SN-ADD-PND",
            "manufacturer": "Mfg",
        })
        asset = Asset.objects.get(asset_code="AST-ADD-PND")
        self.assertEqual(asset.approval_status, "PENDING")
        self.assertEqual(asset.status, "BLOCKED")


class AssetViewSetUpdateAssetActionTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()

    def test_update_asset_by_name(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("asset-update-asset"), {"asset_name": "MacBook", "brand": "Apple Inc"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.brand, "Apple Inc")

    def test_update_asset_missing_name(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("asset-update-asset"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_asset_not_found(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("asset-update-asset"), {"asset_name": "NonExistent"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_asset_accessible_by_any_authenticated(self):
        self._auth(self.manager)
        resp = self.client.patch(reverse("asset-update-asset"), {"asset_name": "MacBook", "brand": "Apple Inc"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AssetViewSetScanActionTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()

    def test_scan_by_barcode_found(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-scan"), {"barcode": self.asset.barcode}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["found"])
        self.assertEqual(resp.data["asset"]["asset_code"], "AST-001")

    def test_scan_by_barcode_not_found(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-scan"), {"barcode": "NONEXISTENT"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_scan_missing_barcode(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-scan"), {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class AssetViewSetGenerateBarcodesActionTests(BaseAssetAPITest):
    @patch("assets.tasks.generate_barcode_excel_task.delay")
    def test_generate_barcodes_triggers_task(self, mock_task):
        mock_task.return_value.id = "task-123"
        asset = self._create_asset()
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-generate-barcodes"), {"asset_ids": [asset.id]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        mock_task.assert_called_once_with([asset.id])

    def test_generate_barcodes_accessible_by_any_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("asset-generate-barcodes"), {"asset_ids": [1]}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn("task_id", resp.data)

    def test_generate_barcodes_requires_asset_ids(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-generate-barcodes"), {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class AssetViewSetBulkUploadTests(BaseAssetAPITest):
    def _csv_bytes(self, rows):
        header = b"asset_code,asset_name,category,location,department,brand,model_name,serial_number,manufacturer\n"
        return header + b"\n".join(rows)

    @patch("assets.tasks.generate_barcode_excel_task.delay")
    def test_bulk_upload_creates_assets(self, mock_task):
        mock_task.return_value.id = "task-123"
        self._auth(self.manager)
        csv = self._csv_bytes([
            b"AST-B1,Asset1,Electronics,Main Office,IT,Brand1,M1,SN1,Mfg1",
            b"AST-B2,Asset2,Electronics,Main Office,IT,Brand2,M2,SN2,Mfg2",
        ])
        resp = self.client.post(reverse("asset-bulk-upload"), {"file": SimpleUploadedFile("t.csv", csv, content_type="text/csv")}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(Asset.objects.filter(asset_code="AST-B1").exists())
        self.assertTrue(Asset.objects.filter(asset_code="AST-B2").exists())

    def test_bulk_upload_no_file(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("asset-bulk-upload"), {}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("assets.services.send_email.send_new_asset_email")
    def test_bulk_upload_sends_one_email_per_department(self, mock_email):
        self._auth(self.manager)
        csv = self._csv_bytes([
            b"AST-BE1,Asset1,Electronics,Main Office,IT,Brand1,M1,SN1,Mfg1",
            b"AST-BE2,Asset2,Electronics,Main Office,IT,Brand2,M2,SN2,Mfg2",
        ])
        self.client.post(reverse("asset-bulk-upload"), {"file": SimpleUploadedFile("t.csv", csv, content_type="text/csv")}, format="multipart")
        mock_email.assert_called_once()
        qs_arg = mock_email.call_args[0][0]
        self.assertEqual(qs_arg.count(), 2)
        self.assertEqual(mock_email.call_args[0][1], self.dept)

    @patch("assets.services.send_email.send_new_asset_email")
    def test_bulk_upload_separate_depts_separate_emails(self, mock_email):
        Category.objects.create(name="Furniture")
        Location.objects.create(name="Warehouse")
        self._auth(self.manager)
        csv = self._csv_bytes([
            b"AST-MD1,Asset1,Electronics,Main Office,IT,Brand1,M1,SN1,Mfg1",
            b"AST-MD2,Chair1,Furniture,Warehouse,HR,Brand2,M2,SN2,Mfg2",
        ])
        self.client.post(reverse("asset-bulk-upload"), {"file": SimpleUploadedFile("t.csv", csv, content_type="text/csv")}, format="multipart")
        self.assertEqual(mock_email.call_count, 2)
        depts_called = [call[0][1] for call in mock_email.call_args_list]
        self.assertIn(self.dept, depts_called)
        self.assertIn(self.dept2, depts_called)

    @patch("assets.services.send_email.send_new_asset_email")
    def test_bulk_upload_sets_pending_and_blocked(self, mock_email):
        self._auth(self.manager)
        csv = self._csv_bytes([
            b"AST-BP1,Asset1,Electronics,Main Office,IT,Brand1,M1,SN1,Mfg1",
        ])
        self.client.post(reverse("asset-bulk-upload"), {"file": SimpleUploadedFile("t.csv", csv, content_type="text/csv")}, format="multipart")
        asset = Asset.objects.get(asset_code="AST-BP1")
        self.assertEqual(asset.approval_status, "PENDING")
        self.assertEqual(asset.status, "BLOCKED")


# ---------------------------------------------------------------------------
# Approve / Reject Email Tests
# ---------------------------------------------------------------------------

class AssetApproveRejectEmailTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset(approval_status="PENDING", status="BLOCKED")

    def test_approve_email_success(self):
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-approve-email", args=[self.asset.approval_token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.approval_status, "APPROVED")
        self.assertEqual(self.asset.status, "ACTIVE")

    def test_approve_email_invalid_token(self):
        self._auth(self.super_admin)
        resp = self.client.get(
            reverse("asset-approve-email", args=["00000000-0000-0000-0000-000000000000"])
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_approve_email_already_approved(self):
        self._auth(self.super_admin)
        self.client.get(reverse("asset-approve-email", args=[self.asset.approval_token]))
        resp = self.client.get(reverse("asset-approve-email", args=[self.asset.approval_token]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_email_success(self):
        self._auth(self.super_admin)
        resp = self.client.get(reverse("asset-reject-email", args=[self.asset.approval_token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertEqual(self.asset.approval_status, "REJECTED")
        self.assertEqual(self.asset.status, "BLOCKED")

    def test_reject_email_invalid_token(self):
        self._auth(self.super_admin)
        resp = self.client.get(
            reverse("asset-reject-email", args=["00000000-0000-0000-0000-000000000000"])
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_reject_email_already_rejected(self):
        self._auth(self.super_admin)
        self.client.get(reverse("asset-reject-email", args=[self.asset.approval_token]))
        resp = self.client.get(reverse("asset-reject-email", args=[self.asset.approval_token]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Category ViewSet Tests
# ---------------------------------------------------------------------------

class CategoryViewSetTests(BaseAssetAPITest):
    def test_list_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("category-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_requires_super_admin(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("category-list"), {"name": "Test"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_create(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("category-list"), {"name": "Furniture"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Category.objects.filter(name="Furniture").exists())

    def test_add_action_creates_category(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("category-add"), {"name": "NewCategory"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Category.objects.filter(name="NewCategory").exists())

    def test_add_action_requires_name(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("category-add"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_action_get_or_create_existing(self):
        self._auth(self.super_admin)
        Category.objects.create(name="Existing")
        resp = self.client.post(reverse("category-add"), {"name": "Existing"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data["created"])

    def test_update_category_action(self):
        cat = Category.objects.create(name="OldName")
        self.assertEqual(cat.name, "OldName")
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("category-update-category"), {"name": "OldName"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_update_category_not_found(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("category-update-category"), {"name": "NonExistent"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_remove_category_action(self):
        Category.objects.create(name="ToDelete")
        self._auth(self.super_admin)
        resp = self.client.delete(reverse("category-remove-category"), {"name": "ToDelete"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(name="ToDelete").exists())

    def test_remove_category_not_found(self):
        self._auth(self.super_admin)
        resp = self.client.delete(reverse("category-remove-category"), {"name": "NonExistent"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Location ViewSet Tests
# ---------------------------------------------------------------------------

class LocationViewSetTests(BaseAssetAPITest):
    def test_list_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("location-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_requires_super_admin(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("location-list"), {"name": "Test"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_create(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("location-list"), {
            "name": "Warehouse", "building": "W1", "floor": "G", "room": "1",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_add_action(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("location-add"), {"name": "NewLoc"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Location.objects.filter(name="NewLoc").exists())

    def test_add_action_requires_name(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("location-add"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_location_action(self):
        Location.objects.create(name="OldLoc", building="B1", floor="1", room="R1")
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("location-update-location"), {"name": "OldLoc", "building": "B2"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["data"]["building"], "B2")

    def test_update_location_not_found(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("location-update-location"), {"name": "NonExistent"})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# Document ViewSet Tests
# ---------------------------------------------------------------------------

class DocumentViewSetTests(BaseAssetAPITest):
    def test_create_document_with_file(self):
        self._auth(self.regular_user)
        file = SimpleUploadedFile("test.pdf", b"%PDF-1.4 content", content_type="application/pdf")
        resp = self.client.post(reverse("document-list"), {"file": file}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["file_name"], "test.pdf")

    def test_create_document_without_file(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("document-list"), {}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_download_document(self):
        self._auth(self.regular_user)
        doc = Document.objects.create(
            file_name="doc.pdf", content_type="application/pdf",
            file_size=15, file_data=b"%PDF-1.4 content",
        )
        resp = self.client.get(reverse("document-download", args=[doc.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.content, b"%PDF-1.4 content")


# ---------------------------------------------------------------------------
# ServiceType ViewSet Tests
# ---------------------------------------------------------------------------

class ServiceTypeViewSetTests(BaseAssetAPITest):
    def test_list_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("servicetype-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_requires_super_admin(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("servicetype-list"), {"name": "Test"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_create(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("servicetype-list"), {"name": "Support"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_filter_by_department(self):
        ServiceType.objects.create(name="Dept Service", department=self.dept)
        self._auth(self.regular_user)
        resp = self.client.get(reverse("servicetype-list"), {"department": self.dept.id})
        self.assertEqual(len(resp.data["results"]), 1)


# ---------------------------------------------------------------------------
# Availability ViewSet Tests
# ---------------------------------------------------------------------------

class AvailabilityViewSetTests(BaseAssetAPITest):
    def test_list_authenticated(self):
        Availability.objects.create(name="24/7")
        self._auth(self.regular_user)
        resp = self.client.get(reverse("availability-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("availability-list"), {"name": "Business Hours"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_search(self):
        Availability.objects.create(name="24/7")
        Availability.objects.create(name="Business Hours")
        self._auth(self.regular_user)
        resp = self.client.get(reverse("availability-list"), {"search": "24/7"})
        self.assertEqual(len(resp.data["results"]), 1)


# ---------------------------------------------------------------------------
# AssetService ViewSet Tests
# ---------------------------------------------------------------------------

class AssetServiceViewSetTests(BaseAssetAPITest):
    def setUp(self):
        super().setUp()
        self.asset = self._create_asset()
        self.st = ServiceType.objects.create(name="Warranty")
        from datetime import date
        self.asv = AssetServiceModel.objects.create(
            asset=self.asset, service_type=self.st,
            start_date=date(2024, 1, 1), end_date=date(2025, 1, 1),
        )

    def test_list_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("assetservice-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_super_admin_sees_all(self):
        dept3 = Department.objects.create(department_name="Finance", code="FIN")
        cat2 = Category.objects.create(name="Furniture")
        loc2 = Location.objects.create(name="Warehouse")
        asset2 = Asset.objects.create(
            asset_code="AST-002", asset_name="Chair",
            category=cat2, brand="Ikea", model_name="M1",
            location=loc2, department=dept3,
            serial_number="SN-CH", manufacturer="Ikea",
        )
        from datetime import date
        AssetServiceModel.objects.create(
            asset=asset2, service_type=self.st,
            start_date=date(2024, 1, 1), end_date=date(2025, 1, 1),
        )
        self._auth(self.super_admin)
        resp = self.client.get(reverse("assetservice-list"))
        self.assertEqual(len(resp.data["results"]), 2)

    def test_user_sees_only_own_department(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("assetservice-list"))
        self.assertEqual(len(resp.data["results"]), 1)

    def test_create_requires_manager(self):
        self._auth(self.regular_user)
        from datetime import date
        resp = self.client.post(reverse("assetservice-list"), {
            "asset": self.asset.id, "service_type": self.st.id,
            "start_date": "2024-01-01", "end_date": "2025-01-01",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_create(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("assetservice-list"), {
            "asset": self.asset.id, "service_type": self.st.id,
            "start_date": "2024-06-01", "end_date": "2025-06-01",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Dashboard Stats Tests
# ---------------------------------------------------------------------------

class DashboardStatsTests(BaseAssetAPITest):
    def test_unauthenticated(self):
        resp = self.client.get(reverse("dashboard-stats"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("assets.views.dashboard_views.AssetService.get_dashboard_stats")
    def test_returns_valid_kpi_structure(self, mock_get_stats):
        mock_get_stats.return_value = {
            "total_assets": 2, "active_assets": 1, "repair_assets": 1,
            "missing_assets": 0, "retired_assets": 0, "blocked_assets": 0,
            "pending_procurements": 0, "assets_by_category": [],
            "assets_by_department": [], "monthly_additions": [],
            "repair_analytics": {}, "audit_trends": [],
        }
        self._auth(self.super_admin)
        resp = self.client.get(reverse("dashboard-stats"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total_assets"], 2)
        self.assertIn("repair_analytics", resp.data)


# ---------------------------------------------------------------------------
# AssetService Tests
# ---------------------------------------------------------------------------

class AssetServiceTests(BaseAssetAPITest):
    def test_get_scoped_asset_qs_super_admin(self):
        self._create_asset(asset_code="AST-001", dept=self.dept)
        self._create_asset(asset_code="AST-002", dept=self.dept2)
        qs = AssetService.get_scoped_asset_qs(self.super_admin)
        self.assertEqual(qs.count(), 2)

    def test_get_scoped_asset_qs_user(self):
        self._create_asset(asset_code="AST-001", dept=self.dept)
        self._create_asset(asset_code="AST-002", dept=self.dept2)
        qs = AssetService.get_scoped_asset_qs(self.regular_user)
        self.assertEqual(qs.count(), 1)

    def test_get_scoped_asset_qs_no_department(self):
        user = User.objects.create_user(username="nodapt", password="pass1234", role="USER")
        qs = AssetService.get_scoped_asset_qs(user)
        self.assertEqual(qs.count(), 0)

    def test_get_scoped_repair_qs(self):
        from repairs.models import RepairTicket
        asset = self._create_asset()
        RepairTicket.objects.create(asset=asset, issue_description="Broken")
        qs = AssetService.get_scoped_repair_qs(self.super_admin)
        self.assertEqual(qs.count(), 1)

    def test_get_scoped_procurement_qs(self):
        ProcurementRequest.objects.create(
            department=self.dept, requested_by=self.regular_user,
        )
        qs = AssetService.get_scoped_procurement_qs(self.super_admin)
        self.assertEqual(qs.count(), 1)


# ---------------------------------------------------------------------------
# BarcodeService Tests
# ---------------------------------------------------------------------------

class BarcodeServiceTests(TestCase):
    def test_generate_barcode_string_length(self):
        result = BarcodeService.generate_barcode_string("test-input")
        self.assertEqual(len(result), 20)

    def test_generate_barcode_string_uppercase(self):
        result = BarcodeService.generate_barcode_string("test-input")
        self.assertEqual(result, result.upper())

    def test_generate_barcode_string_deterministic(self):
        r1 = BarcodeService.generate_barcode_string("hello")
        r2 = BarcodeService.generate_barcode_string("hello")
        self.assertEqual(r1, r2)

    def test_generate_barcode_image(self):
        code = BarcodeService.generate_barcode_string("test")
        buf = BarcodeService.generate_barcode_image(code)
        self.assertIsNotNone(buf)

    def test_auto_generate_barcode(self):
        result = BarcodeService.auto_generate_barcode("AST-001", "MacBook")
        self.assertEqual(len(result), 20)

    def test_generate_barcode_excel_no_assets(self):
        result = BarcodeService.generate_barcode_excel([])
        self.assertEqual(result, b"")

    def test_generate_barcode_excel_with_assets(self):
        dept = Department.objects.create(department_name="IT", code="IT")
        cat = Category.objects.create(name="Electronics")
        loc = Location.objects.create(name="Office")
        asset = Asset.objects.create(
            asset_code="AST-001", asset_name="MacBook",
            category=cat, brand="Apple", model_name="M3",
            location=loc, department=dept,
            serial_number="SN123", manufacturer="Apple",
        )
        result = BarcodeService.generate_barcode_excel([asset.id])
        self.assertNotEqual(result, b"")
        self.assertTrue(result.startswith(b"PK"))


# ---------------------------------------------------------------------------
# BulkUploadService Tests
# ---------------------------------------------------------------------------

class BulkUploadServiceTests(TestCase):
    def test_generate_template_returns_http_response(self):
        resp = BulkUploadService.generate_template()
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("application", resp["Content-Type"])

    def test_process_upload_csv(self):
        csv_content = b"asset_code,asset_name,category,location,department,brand,model_name,serial_number,manufacturer\n"
        csv_content += b"AST-BULK,Bulk Asset,Electronics,Main Office,IT,TestBrand,M1,SN-BULK,TestMfg\n"
        file = SimpleUploadedFile("test.csv", csv_content, content_type="text/csv")
        created, errors = BulkUploadService.process_upload(file)
        self.assertEqual(len(created), 1)
        self.assertEqual(len(errors), 0)
        self.assertEqual(created[0].asset_code, "AST-BULK")

    def test_process_upload_invalid_format(self):
        file = SimpleUploadedFile("test.txt", b"data", content_type="text/plain")
        with self.assertRaises(ValueError):
            BulkUploadService.process_upload(file)

    def test_process_upload_missing_required_fields(self):
        csv_content = b"asset_code,asset_name,category,location,department,brand,model_name,serial_number,manufacturer\n"
        csv_content += b"AST-001,Test,missing_cat,Office,IT,Brand,M1,SN1,Mfg\n"
        file = SimpleUploadedFile("test.csv", csv_content, content_type="text/csv")
        created, errors = BulkUploadService.process_upload(file)
        self.assertEqual(len(created), 1)

    def test_process_upload_auto_creates_related(self):
        csv_content = b"asset_code,asset_name,category,location,department,brand,model_name,serial_number,manufacturer\n"
        csv_content += b"AST-NEW,New Asset,AutoCat,AutoLoc,AutoDept,Brand,M1,SN1,Mfg\n"
        file = SimpleUploadedFile("test.csv", csv_content, content_type="text/csv")
        created, errors = BulkUploadService.process_upload(file)
        self.assertEqual(len(created), 1)
        self.assertTrue(Category.objects.filter(name__iexact="AutoCat").exists())
        self.assertTrue(Location.objects.filter(name__iexact="AutoLoc").exists())
        self.assertTrue(Department.objects.filter(department_name__iexact="AutoDept").exists())

    def test_process_upload_vendor_auto_create(self):
        csv_content = b"asset_code,asset_name,category,location,department,brand,model_name,serial_number,manufacturer,vendor\n"
        csv_content += b"AST-VEN,Vendor Asset,Electronics,Office,IT,Brand,M1,SN1,Mfg,NewVendor\n"
        file = SimpleUploadedFile("test.csv", csv_content, content_type="text/csv")
        created, errors = BulkUploadService.process_upload(file)
        self.assertEqual(len(created), 1)
        self.assertTrue(Vendor.objects.filter(vendor_name__iexact="NewVendor").exists())


# ---------------------------------------------------------------------------
# Signal Tests
# ---------------------------------------------------------------------------

class AssetSignalTests(BaseAssetAPITest):
    @patch("notifications.tasks.create_notification_task")
    def test_asset_created_triggers_notification(self, mock_task):
        asset = self._create_asset()
        mock_task.delay.assert_called_once()
        _, kwargs = mock_task.delay.call_args
        self.assertEqual(kwargs["title"], "Asset Approval Required")
        self.assertIn(asset.asset_name, kwargs["message"])
        self.assertEqual(kwargs["target_role"], "DEPARTMENT_ADMIN")
        self.assertEqual(kwargs["department_id"], self.dept.id)
        self.assertEqual(kwargs["related_object_id"], asset.id)

    @patch("notifications.tasks.create_notification_task")
    def test_asset_update_does_not_trigger_signal(self, mock_task):
        asset = self._create_asset()
        mock_task.delay.reset_mock()
        asset.asset_name = "Updated Name"
        asset.save()
        mock_task.delay.assert_not_called()


# ---------------------------------------------------------------------------
# Email Service Tests
# ---------------------------------------------------------------------------

class SendNewAssetEmailTests(BaseAssetAPITest):
    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_send_new_asset_email_sends_with_excel(self):
        asset = self._create_asset()
        qs = Asset.objects.filter(pk=asset.pk)
        with patch("assets.services.send_email.smtplib.SMTP") as mock_smtp:
            mock_server = mock_smtp.return_value.__enter__.return_value
            result = send_new_asset_email(qs, self.dept)
            self.assertTrue(result)
            mock_smtp.assert_called_once()
            mock_server.send_message.assert_called_once()

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_excel_attachment_present(self):
        asset = self._create_asset()
        qs = Asset.objects.filter(pk=asset.pk)
        with patch("assets.services.send_email.smtplib.SMTP") as mock_smtp:
            mock_server = mock_smtp.return_value.__enter__.return_value
            send_new_asset_email(qs, self.dept)
            msg = mock_server.send_message.call_args[0][0]
            has_xlsx = any(
                p.get_content_type() == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                for p in msg.walk()
            )
            self.assertTrue(has_xlsx)

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_body_has_summary_with_count(self):
        a1 = self._create_asset(asset_code="AST-S1", serial_number="SN-S1")
        a2 = self._create_asset(asset_code="AST-S2", serial_number="SN-S2")
        qs = Asset.objects.filter(pk__in=[a1.pk, a2.pk])
        with patch("assets.services.send_email.smtplib.SMTP") as mock_smtp:
            mock_server = mock_smtp.return_value.__enter__.return_value
            send_new_asset_email(qs, self.dept)
            msg = mock_server.send_message.call_args[0][0]
            html = _extract_html(msg)
            self.assertIn("2</strong> new asset(s)", html)
            self.assertIn(self.dept.department_name, html)

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_subject_includes_dept_name(self):
        asset = self._create_asset()
        qs = Asset.objects.filter(pk=asset.pk)
        with patch("assets.services.send_email.smtplib.SMTP") as mock_smtp:
            mock_server = mock_smtp.return_value.__enter__.return_value
            send_new_asset_email(qs, self.dept)
            msg = mock_server.send_message.call_args[0][0]
            self.assertIn(self.dept.department_name, msg['Subject'])

    @override_settings(EMAIL_HOST_USER="")
    def test_returns_false_no_host(self):
        qs = Asset.objects.filter(pk=self._create_asset().pk)
        result = send_new_asset_email(qs, self.dept)
        self.assertFalse(result)

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_returns_false_no_admins(self):
        dept_no_admins = Department.objects.create(department_name="NoAdmin", code="NA")
        asset = self._create_asset(
            dept=dept_no_admins, asset_code="AST-NA", serial_number="SN-NA",
        )
        qs = Asset.objects.filter(pk=asset.pk)
        result = send_new_asset_email(qs, dept_no_admins)
        self.assertFalse(result)

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_returns_false_none_department(self):
        result = send_new_asset_email(Asset.objects.none(), None)
        self.assertFalse(result)

    @override_settings(EMAIL_HOST_USER="test@example.com")
    def test_returns_false_empty_queryset(self):
        result = send_new_asset_email(Asset.objects.none(), self.dept)
        self.assertFalse(result)


class BuildReportEmailTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.user = User.objects.create_user(
            username="admin", password="pass", role="SUPER_ADMIN",
            department=self.dept, email="admin@example.com",
        )

    def _create_report(self, **kw):
        from reports.models import Report
        defaults = dict(
            title="Weekly Report", report_type="WEEKLY", status="READY",
            summary_data={
                "total_assets": 10, "active_assets": 8, "missing_assets": 0,
                "under_repair": 1, "pending_procurements": 2,
                "repairs_last_week": 3, "proc_last_week": 1, "total_repairs": 5,
            },
            generated_by=self.user, department=self.dept,
        )
        defaults.update(kw)
        return Report.objects.create(**defaults)

    @override_settings(EMAIL_HOST_USER="test@example.com", REPORT_EMAIL_RECIPIENTS=["recipient@example.com"])
    def test_build_report_email_structure(self):
        report = self._create_report()
        msg = build_report_email(report)
        self.assertEqual(msg['From'], "test@example.com")
        self.assertIn("Weekly Inventory Summary", msg['Subject'])

    @override_settings(EMAIL_HOST_USER="test@example.com", REPORT_EMAIL_RECIPIENTS=["recipient@example.com"])
    def test_build_report_email_contains_kpis(self):
        report = self._create_report()
        msg = build_report_email(report)
        html = _extract_html(msg)
        self.assertIn("10", html)
        self.assertIn("8", html)

    @override_settings(EMAIL_HOST_USER="", REPORT_EMAIL_RECIPIENTS=["recipient@example.com"])
    def test_send_report_email_returns_false_no_host(self):
        report = self._create_report()
        result = send_report_email(report)
        self.assertFalse(result)

    @override_settings(EMAIL_HOST_USER="test@example.com", REPORT_EMAIL_RECIPIENTS=["recipient@example.com"])
    @patch("assets.services.send_email.smtplib.SMTP")
    def test_send_report_email_sends_successfully(self, mock_smtp):
        report = self._create_report()
        mock_server = mock_smtp.return_value.__enter__.return_value
        result = send_report_email(report)
        self.assertTrue(result)
        mock_server.send_message.assert_called_once()


# ---------------------------------------------------------------------------
# Task Tests
# ---------------------------------------------------------------------------

class GenerateBarcodeExcelTaskTests(BaseAssetAPITest):
    @patch("assets.tasks.generate_barcode_image")
    def test_task_returns_bytes_with_assets(self, mock_gen_img):
        mock_gen_img.return_value = BytesIO(_minimal_png())
        asset = self._create_asset()
        from assets.tasks import generate_barcode_excel_task
        result = generate_barcode_excel_task([asset.id])
        self.assertIsInstance(result, bytes)
        self.assertTrue(len(result) > 0)

    def test_task_returns_message_no_assets(self):
        from assets.tasks import generate_barcode_excel_task
        result = generate_barcode_excel_task([])
        self.assertEqual(result, "No assets found")

    def test_task_returns_message_invalid_ids(self):
        from assets.tasks import generate_barcode_excel_task
        result = generate_barcode_excel_task([99999])
        self.assertEqual(result, "No assets found")


# ---------------------------------------------------------------------------
# Permission Tests
# ---------------------------------------------------------------------------

class PermissionTests(BaseAssetAPITest):
    def test_is_auth_authenticated(self):
        from assets.views.permissions import IsAuth
        request = MagicMock()
        request.user = self.regular_user
        self.assertTrue(IsAuth().has_permission(request, None))

    def test_is_auth_unauthenticated(self):
        from assets.views.permissions import IsAuth
        request = MagicMock()
        request.user.is_authenticated = False
        self.assertFalse(IsAuth().has_permission(request, None))

    def test_is_manager_or_above(self):
        from assets.views.permissions import IsManagerOrAbove
        for role in ("MANAGER", "DEPARTMENT_ADMIN", "SUPER_ADMIN"):
            request = MagicMock()
            request.user.is_authenticated = True
            request.user.role = role
            self.assertTrue(IsManagerOrAbove().has_permission(request, None))

    def test_is_manager_or_above_user_fails(self):
        from assets.views.permissions import IsManagerOrAbove
        request = MagicMock()
        request.user.is_authenticated = True
        request.user.role = "USER"
        self.assertFalse(IsManagerOrAbove().has_permission(request, None))

    def test_is_super_admin(self):
        from assets.views.permissions import IsSuperAdmin
        request = MagicMock()
        request.user.is_authenticated = True
        request.user.role = "SUPER_ADMIN"
        self.assertTrue(IsSuperAdmin().has_permission(request, None))

    def test_is_super_admin_non_super_fails(self):
        from assets.views.permissions import IsSuperAdmin
        request = MagicMock()
        request.user.is_authenticated = True
        request.user.role = "DEPARTMENT_ADMIN"
        self.assertFalse(IsSuperAdmin().has_permission(request, None))
