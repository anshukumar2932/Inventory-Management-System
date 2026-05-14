from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from .models import Vendor, VendorCategory, Service, ClientCompany
from assets.models import Category


class VendorModelTests(TestCase):
    def setUp(self):
        self.vcat = VendorCategory.objects.create(name="Electronics")

    def test_vendor_code_auto_generated_by_view(self):
        client = APIClient()
        admin = User.objects.create_user(username="a", password="pass1234", role="SUPER_ADMIN")
        client.force_authenticate(user=admin)
        resp = client.post(reverse("vendor-add"), {
            "vendor_name": "CodeTestVendor",
            "contact_person": "John",
            "email": "code@test.com",
            "phone": "1234567890",
            "address": "123 St",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(resp.data["data"]["vendor_code"])

    def test_vendor_default_status_pending(self):
        vendor = Vendor.objects.create(
            vendor_name="Tech Corp",
            contact_person="John",
            email="john@tech.com",
            phone="1234567890",
            address="123 Street",
        )
        self.assertEqual(vendor.status, "PENDING")

    def test_vendor_default_is_deleted_false(self):
        vendor = Vendor.objects.create(
            vendor_name="Tech Corp",
            contact_person="John",
            email="john@tech.com",
            phone="1234567890",
            address="123 Street",
        )
        self.assertFalse(vendor.is_deleted)

    def test_vendor_str(self):
        vendor = Vendor.objects.create(
            vendor_name="Tech Corp",
            vendor_category=self.vcat,
            contact_person="John",
            email="john@tech.com",
            phone="1234567890",
            address="123 Street",
        )
        self.assertIn("Tech Corp", str(vendor))

    def test_service_model(self):
        svc = Service.objects.create(service_name="Cleaning")
        self.assertEqual(str(svc), "Cleaning")

    def test_client_company_model(self):
        co = ClientCompany.objects.create(company_name="Acme Inc")
        self.assertEqual(str(co), "Acme Inc")


class BaseVendorTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.super_admin = User.objects.create_user(
            username="admin", password="admin1234", role="SUPER_ADMIN",
            department=self.dept, email="admin@example.com",
        )
        self.regular_user = User.objects.create_user(
            username="user", password="user1234", role="USER",
            department=self.dept,
        )
        self.vcat = VendorCategory.objects.create(name="Electronics")

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    _vendor_counter = 0

    def _create_vendor(self, **kwargs):
        BaseVendorTest._vendor_counter += 1
        c = BaseVendorTest._vendor_counter
        defaults = dict(
            vendor_name=f"Tech Corp {c}",
            vendor_category=self.vcat,
            contact_person="John Doe",
            email=f"john{c}@techcorp.com",
            phone=f"98765432{c:02d}",
            address=f"456 Tech St, Unit {c}",
        )
        defaults.update(kwargs)
        return Vendor.objects.create(**defaults)


class VendorViewSetTests(BaseVendorTest):
    def test_list_unauthenticated(self):
        resp = self.client.get(reverse("vendor-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_authenticated(self):
        self._auth(self.regular_user)
        self._create_vendor()
        resp = self.client.get(reverse("vendor-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_list_filters_out_deleted(self):
        self._auth(self.regular_user)
        v = self._create_vendor()
        v.is_deleted = True
        v.save()
        resp = self.client.get(reverse("vendor-list"))
        self.assertEqual(len(resp.data["results"]), 0)

    def test_filter_by_status(self):
        self._auth(self.regular_user)
        self._create_vendor(vendor_name="Active Vendor", status="ACTIVE")
        self._create_vendor(vendor_name="Inactive Vendor", status="INACTIVE")
        resp = self.client.get(reverse("vendor-list"), {"status": "ACTIVE"})
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["vendor_name"], "Active Vendor")

    def test_filter_by_category(self):
        self._auth(self.regular_user)
        vcat2 = VendorCategory.objects.create(name="Furniture")
        self._create_vendor(vendor_name="V1")
        v2 = self._create_vendor(vendor_name="V2", vendor_category=vcat2)
        resp = self.client.get(reverse("vendor-list"), {"category": vcat2.id})
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["vendor_name"], "V2")

    def test_search_by_vendor_name(self):
        self._auth(self.regular_user)
        self._create_vendor(vendor_name="Alpha Technologies")
        self._create_vendor(vendor_name="Beta Corp")
        resp = self.client.get(reverse("vendor-list"), {"search": "Alpha"})
        self.assertEqual(len(resp.data["results"]), 1)

    def test_create_vendor(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("vendor-list"), {
            "vendor_name": "New Vendor",
            "vendor_category": self.vcat.id,
            "contact_person": "Jane",
            "email": "jane@newvendor.com",
            "phone": "1112223333",
            "address": "789 New St",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Vendor.objects.filter(vendor_name="New Vendor").exists())

    def test_retrieve_vendor(self):
        self._auth(self.regular_user)
        v = self._create_vendor()
        resp = self.client.get(reverse("vendor-detail", args=[v.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["vendor_name"], v.vendor_name)

    def test_update_vendor(self):
        self._auth(self.regular_user)
        v = self._create_vendor()
        resp = self.client.patch(reverse("vendor-detail", args=[v.id]), {"contact_person": "Jane Updated"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        v.refresh_from_db()
        self.assertEqual(v.contact_person, "Jane Updated")


class VendorAddActionTests(BaseVendorTest):
    def test_add_action_requires_vendor_name(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("vendor-add"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vendor_name is required", str(resp.data))

    def test_add_creates_vendor(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("vendor-add"), {
            "vendor_name": "NewVendor",
            "contact_person": "John",
            "email": "john@nv.com",
            "phone": "5555555555",
            "address": "Addr",
            "vendor_category": self.vcat.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["created"])
        self.assertEqual(resp.data["data"]["vendor_name"], "NewVendor")

    def test_add_get_or_create_existing(self):
        self._auth(self.regular_user)
        self.client.post(reverse("vendor-add"), {
            "vendor_name": "ExistingVendor",
            "contact_person": "John",
            "email": "john@ev.com",
            "phone": "5555555555",
            "address": "Addr",
        })
        resp = self.client.post(reverse("vendor-add"), {
            "vendor_name": "ExistingVendor",
            "contact_person": "John",
            "email": "john@ev.com",
            "phone": "5555555555",
            "address": "Addr",
        })
        self.assertFalse(resp.data["created"])

    def test_add_with_invalid_category(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("vendor-add"), {
            "vendor_name": "BadCatVendor",
            "vendor_category": 9999,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_parses_services_and_categories(self):
        self._auth(self.regular_user)
        cat = Category.objects.create(name="Office Supplies")
        resp = self.client.post(reverse("vendor-add"), {
            "vendor_name": "FullServiceVendor",
            "contact_person": "John",
            "email": "john@fsv.com",
            "phone": "5555555555",
            "address": "Addr",
            "services": "Cleaning,Repair",
            "supported_categories": "Office Supplies",
            "served_companies": "Acme Corp",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        vendor = Vendor.objects.get(vendor_name="FullServiceVendor")
        self.assertEqual(vendor.services.count(), 2)
        self.assertEqual(vendor.supported_categories.count(), 1)
        self.assertEqual(vendor.served_companies.count(), 1)


class VendorSoftDeleteTests(BaseVendorTest):
    def test_soft_delete_sets_is_deleted(self):
        self._auth(self.regular_user)
        v = self._create_vendor()
        resp = self.client.delete(reverse("vendor-soft-delete", args=[v.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        v.refresh_from_db()
        self.assertTrue(v.is_deleted)

    def test_soft_deleted_not_in_list(self):
        self._auth(self.regular_user)
        v = self._create_vendor()
        self.client.delete(reverse("vendor-soft-delete", args=[v.id]))
        resp = self.client.get(reverse("vendor-list"))
        self.assertEqual(len(resp.data["results"]), 0)


class VendorSerializerTests(BaseVendorTest):
    def test_read_only_fields(self):
        self._auth(self.regular_user)
        svc = Service.objects.create(service_name="IT Support")
        cat = Category.objects.create(name="Hardware")
        co = ClientCompany.objects.create(company_name="Client Inc")
        v = self._create_vendor()
        v.services.add(svc)
        v.supported_categories.add(cat)
        v.served_companies.add(co)
        from vendors.serializers import VendorSerializer
        serializer = VendorSerializer(v)
        self.assertIn("IT Support", serializer.data["service_names"])
        self.assertIn("Hardware", serializer.data["category_names"])
        self.assertIn("Client Inc", serializer.data["company_names"])
        self.assertEqual(serializer.data["vendor_category_name"], "Electronics")
