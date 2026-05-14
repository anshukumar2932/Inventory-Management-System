from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, Department


class DepartmentModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")

    def test_department_str(self):
        self.assertEqual(str(self.dept), "IT")

    def test_department_ordering(self):
        Department.objects.create(department_name="Accounts", code="ACC")
        qs = Department.objects.all()
        self.assertEqual(qs[0].department_name, "Accounts")


class UserModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")

    def test_user_str(self):
        user = User.objects.create_user(username="testuser", password="pass1234", department=self.dept)
        self.assertEqual(str(user), "testuser")

    def test_user_default_status_active(self):
        user = User.objects.create_user(username="testuser", password="pass1234")
        self.assertEqual(user.status, "ACTIVE")

    def test_user_default_role_user(self):
        user = User.objects.create_user(username="testuser", password="pass1234")
        self.assertEqual(user.role, "USER")


class BaseAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
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


class LoginTests(BaseAPITest):
    def test_login_success(self):
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin", "password": "admin1234",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertIn("user", resp.data)

    def test_login_failure(self):
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin", "password": "wrong",
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_includes_username_and_role(self):
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin", "password": "admin1234",
        })
        from rest_framework_simplejwt.tokens import AccessToken
        token = AccessToken(resp.data["access"])
        self.assertEqual(token["username"], "admin")
        self.assertEqual(token["role"], "SUPER_ADMIN")


class LogoutTests(BaseAPITest):
    def test_logout_with_valid_token(self):
        resp = self.client.post(reverse("token_obtain_pair"), {
            "username": "admin", "password": "admin1234",
        })
        refresh = resp.data["refresh"]
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.post(reverse("logout"), {"refresh": refresh})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_logout_with_invalid_token(self):
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.post(reverse("logout"), {"refresh": "invalid"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class UserDetailTests(BaseAPITest):
    def test_get_me_authenticated(self):
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.get(reverse("user_detail"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "admin")

    def test_get_me_unauthenticated(self):
        resp = self.client.get(reverse("user_detail"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_me(self):
        self.client.force_authenticate(user=self.regular_user)
        resp = self.client.patch(reverse("user_detail"), {"email": "new@example.com"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.regular_user.refresh_from_db()
        self.assertEqual(self.regular_user.email, "new@example.com")


class UserViewSetTests(BaseAPITest):
    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_list_users_unauthenticated(self):
        resp = self.client.get(reverse("user-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_users_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("user-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_user_by_super_admin(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("user-list"), {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass12",
            "role": "USER",
            "department": self.dept.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newuser").exists())

    def test_create_user_by_department_admin_sets_own_dept(self):
        self._auth(self.dept_admin)
        other_dept = Department.objects.create(department_name="HR", code="HR")
        resp = self.client.post(reverse("user-list"), {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass12",
            "role": "USER",
            "department": other_dept.id,
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.department, self.dept)

    def test_create_user_by_manager_forbidden(self):
        self._auth(self.manager)
        resp = self.client.post(reverse("user-list"), {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass12",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_user_by_regular_user_forbidden(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("user-list"), {
            "username": "newuser",
            "email": "new@example.com",
            "password": "newpass12",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_user_only_super_admin(self):
        self._auth(self.manager)
        resp = self.client.patch(reverse("user-detail", args=[self.regular_user.id]), {"email": "x@y.com"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_update_user(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("user-detail", args=[self.regular_user.id]), {"email": "x@y.com"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.regular_user.refresh_from_db()
        self.assertEqual(self.regular_user.email, "x@y.com")

    def test_update_user_password(self):
        self._auth(self.super_admin)
        resp = self.client.patch(reverse("user-detail", args=[self.regular_user.id]), {"password": "newlongpass"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.regular_user.refresh_from_db()
        self.assertTrue(self.regular_user.check_password("newlongpass"))

    def test_delete_user_only_super_admin(self):
        self._auth(self.manager)
        resp = self.client.delete(reverse("user-detail", args=[self.regular_user.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_delete_user(self):
        self._auth(self.super_admin)
        resp = self.client.delete(reverse("user-detail", args=[self.regular_user.id]))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=self.regular_user.id).exists())


class DepartmentViewSetTests(BaseAPITest):
    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_list_departments_authenticated(self):
        self._auth(self.regular_user)
        resp = self.client.get(reverse("department-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_department_super_admin_only(self):
        self._auth(self.regular_user)
        resp = self.client.post(reverse("department-list"), {
            "department_name": "HR",
            "services": ["Payroll"],
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_can_create_department(self):
        self._auth(self.super_admin)
        resp = self.client.post(reverse("department-list"), {
            "department_name": "HR",
            "services": ["Payroll"],
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Department.objects.filter(department_name="HR").exists())

    def test_create_department_with_existing_service_fails(self):
        from assets.models import ServiceType
        ServiceType.objects.create(name="Payroll", department=self.dept)
        self._auth(self.super_admin)
        resp = self.client.post(reverse("department-list"), {
            "department_name": "HR",
            "services": ["Payroll"],
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tree(self):
        child = Department.objects.create(department_name="Child", code="CH", parent=self.dept)
        self._auth(self.super_admin)
        resp = self.client.get(reverse("department-tree"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        names = [r["name"] for r in resp.data]
        self.assertIn("IT", names)
