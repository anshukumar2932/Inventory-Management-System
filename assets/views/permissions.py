from rest_framework.permissions import BasePermission


class IsAuth(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated


class IsManagerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("MANAGER", "DEPARTMENT_ADMIN", "SUPER_ADMIN")


class IsDeptAdminOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("DEPARTMENT_ADMIN", "SUPER_ADMIN")


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "SUPER_ADMIN"
