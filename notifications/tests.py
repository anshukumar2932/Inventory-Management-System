from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, Department
from .models import Notification
from .tasks import create_notification_task


class NotificationModelTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.user = User.objects.create_user(
            username="testuser", password="pass1234",
            department=self.dept,
        )

    def test_notification_default_unread(self):
        notif = Notification.objects.create(
            user=self.user,
            title="Test",
            message="Test message",
        )
        self.assertFalse(notif.is_read)

    def test_notification_str(self):
        notif = Notification.objects.create(
            user=self.user,
            title="Test Title",
            message="Test message",
        )
        self.assertIn("testuser", str(notif))
        self.assertIn("Test Title", str(notif))

    def test_notification_ordering(self):
        n1 = Notification.objects.create(user=self.user, title="First", message="A")
        n2 = Notification.objects.create(user=self.user, title="Second", message="B")
        qs = Notification.objects.all()
        self.assertEqual(qs.first(), n2)


class BaseNotificationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.user1 = User.objects.create_user(
            username="user1", password="pass1234",
            department=self.dept,
        )
        self.user2 = User.objects.create_user(
            username="user2", password="pass1234",
            department=self.dept,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_notifications(self):
        for i in range(3):
            Notification.objects.create(
                user=self.user1,
                title=f"Notification {i}",
                message=f"Message {i}",
            )
        Notification.objects.create(
            user=self.user2,
            title="Other user",
            message="Not for user1",
        )


class NotificationViewSetTests(BaseNotificationTest):
    def test_list_unauthenticated(self):
        resp = self.client.get(reverse("notifications-list"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_scoped_to_current_user(self):
        self._create_notifications()
        self._auth(self.user1)
        resp = self.client.get(reverse("notifications-list"))
        self.assertEqual(len(resp.data["results"]), 3)

    def test_other_user_notifications_not_visible(self):
        self._create_notifications()
        self._auth(self.user2)
        resp = self.client.get(reverse("notifications-list"))
        self.assertEqual(len(resp.data["results"]), 1)

    def test_retrieve_notification(self):
        notif = Notification.objects.create(user=self.user1, title="Test", message="Msg")
        self._auth(self.user1)
        resp = self.client.get(reverse("notifications-detail", args=[notif.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["title"], "Test")

    def test_cannot_retrieve_other_users_notification(self):
        notif = Notification.objects.create(user=self.user2, title="Test", message="Msg")
        self._auth(self.user1)
        resp = self.client.get(reverse("notifications-detail", args=[notif.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class NotificationCountTests(BaseNotificationTest):
    def test_count_returns_unread_count(self):
        self._create_notifications()
        self._auth(self.user1)
        resp = self.client.get(reverse("notifications-count"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 3)

    def test_count_after_marking_read(self):
        notif = Notification.objects.create(user=self.user1, title="Test", message="Msg")
        notif.is_read = True
        notif.save()
        self._auth(self.user1)
        resp = self.client.get(reverse("notifications-count"))
        self.assertEqual(resp.data["count"], 0)


class NotificationMarkReadTests(BaseNotificationTest):
    def test_mark_read_single(self):
        notif = Notification.objects.create(user=self.user1, title="Test", message="Msg")
        self._auth(self.user1)
        resp = self.client.post(reverse("notifications-mark-read", args=[notif.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    def test_mark_all_read(self):
        for i in range(3):
            Notification.objects.create(user=self.user1, title=f"T{i}", message=f"M{i}")
        self._auth(self.user1)
        resp = self.client.post(reverse("notifications-mark-all-read"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        unread = Notification.objects.filter(user=self.user1, is_read=False).count()
        self.assertEqual(unread, 0)


class NotificationTaskTest(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(department_name="IT", code="IT")
        self.user = User.objects.create_user(
            username="testuser", password="pass1234",
            department=self.dept,
        )

    @patch("notifications.tasks.create_notification_task", wraps=create_notification_task)
    def test_task_creates_notification(self, mock_task):
        mock_task(user_id=self.user.id, title="Test Title", message="Test Message")
        mock_task.assert_called_once()

    def test_task_nonexistent_user(self):
        result = create_notification_task(user_id=9999, title="Test", message="Msg")
        self.assertIn("not found", result)
