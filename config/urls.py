# Root URL configuration — every API route starts here
# Each app handles its own routing via include()
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from assets.views import dashboard_stats

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/refresh/', TokenRefreshView.as_view()),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/assets/', include('assets.urls')),
    # Dashboard stats is a single view, not a whole app — so wired directly
    path('api/v1/dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('api/v1/procurements/', include('procurement.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    path('api/v1/repairs/', include('repairs.urls')),
]
