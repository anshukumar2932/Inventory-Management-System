from django.db.models import Count, Sum
from django.utils import timezone
from datetime import timedelta

from assets.models import Asset
from repairs.models import RepairTicket
from procurement.models import ProcurementRequest


class AssetService:

    @staticmethod
    def get_scoped_asset_qs(user):
        qs = Asset.objects.select_related("category", "location", "department", "vendor")
        if user.role == "SUPER_ADMIN":
            return qs.all()
        if user.department:
            return qs.filter(department=user.department)
        return qs.none()

    @staticmethod
    def get_scoped_repair_qs(user):
        if user.role == "SUPER_ADMIN":
            return RepairTicket.objects.all()
        if user.department:
            return RepairTicket.objects.filter(asset__department=user.department)
        return RepairTicket.objects.none()

    @staticmethod
    def get_scoped_procurement_qs(user):
        if user.role == "SUPER_ADMIN":
            return ProcurementRequest.objects.all()
        if user.department:
            return ProcurementRequest.objects.filter(department=user.department)
        return ProcurementRequest.objects.none()

    @staticmethod
    def get_dashboard_stats(user):
        a_qs = AssetService.get_scoped_asset_qs(user)
        r_qs = AssetService.get_scoped_repair_qs(user)
        p_qs = AssetService.get_scoped_procurement_qs(user)

        total = a_qs.count()
        active = a_qs.filter(status="ACTIVE").count()
        repair = a_qs.filter(status="REPAIR").count()
        missing = a_qs.filter(status="MISSING").count()
        retired = a_qs.filter(status="RETIRED").count()
        blocked = a_qs.filter(status="BLOCKED").count()

        pending_procurements = p_qs.filter(approval_status="PENDING").count()

        cats = (
            a_qs.values("category__name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        assets_by_category = [{"name": c["category__name"], "count": c["count"]} for c in cats]

        depts = (
            a_qs.values("department__department_name")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        assets_by_department = [{"name": d["department__department_name"], "count": d["count"]} for d in depts]

        now = timezone.now()
        months = []
        for i in range(11, -1, -1):
            dt = now - timedelta(days=30 * i)
            months.append(dt.strftime("%Y-%m"))
        monthly_raw = (
            a_qs.extra(select={"ym": "to_char(created_at, 'YYYY-MM')"})
            .values("ym")
            .annotate(count=Count("id"))
            .order_by("ym")
        )
        monthly_map = {m["ym"]: m["count"] for m in monthly_raw}
        monthly_additions = [{"month": m, "count": monthly_map.get(m, 0)} for m in months]

        repair_total = r_qs.aggregate(s=Sum("repair_cost"))["s"] or 0
        repair_analytics = {
            "open_tickets": r_qs.exclude(status__iexact="closed").count(),
            "closed_tickets": r_qs.filter(status__iexact="closed").count(),
            "total_cost": float(repair_total),
        }

        return {
            "total_assets": total,
            "active_assets": active,
            "repair_assets": repair,
            "missing_assets": missing,
            "retired_assets": retired,
            "blocked_assets": blocked,
            "pending_procurements": pending_procurements,
            "assets_by_category": assets_by_category,
            "assets_by_department": assets_by_department,
            "monthly_additions": monthly_additions,
            "repair_analytics": repair_analytics,
            "audit_trends": [],
        }
