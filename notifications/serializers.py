from rest_framework import serializers
from .models import Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):

    notification_type_display = serializers.SerializerMethodField()
    is_critical = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = '__all__'

    def get_notification_type_display(self, obj):
        return obj.get_notification_type_display()

    def get_is_critical(self, obj):
        return obj.notification_type in Notification.CRITICAL_TYPES


class NotificationPreferenceSerializer(serializers.ModelSerializer):

    notification_type_display = serializers.SerializerMethodField()

    class Meta:
        model = NotificationPreference
        fields = '__all__'
        read_only_fields = ['user']

    def get_notification_type_display(self, obj):
        return obj.get_notification_type_display()