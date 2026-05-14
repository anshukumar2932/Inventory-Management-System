import io
import math
import time

import pandas as pd
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage

from accounts.models import Department
from assets.models import Asset, Category, Location
from assets.services.barcode_service import BarcodeService
from vendors.models import Vendor


class BulkUploadService:

    @staticmethod
    def generate_template():
        wb = Workbook()
        ws = wb.active
        ws.title = "Template"
        headers = [
            "asset_code", "asset_name", "category", "brand", "model_name",
            "location", "department", "serial_number", "manufacturer",
            "barcode", "model_detail", "invoice_number", "status",
            "vendor",
        ]
        ws.append(headers)
        ws.append(["AST001", "Laptop Dell XPS", "Electronics", "Dell", "XPS 15",
                    "Main Office", "IT", "SN123456", "Dell Inc.",
                    "", "", "", "ACTIVE", "TechVendor"])
        for col_idx in range(1, len(headers) + 1):
            ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = 18
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="bulk_upload_template.xlsx"'
        return response

    @staticmethod
    def _val(v, default=""):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return default
        return v

    @classmethod
    def process_upload(cls, file):
        ext = file.name.rsplit(".", 1)[-1].lower()
        if ext == "csv":
            df = pd.read_csv(file)
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(file, engine="openpyxl" if ext == "xlsx" else "xlrd")
        else:
            raise ValueError("Unsupported file format")

        df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
        df = df.where(pd.notna(df), None)

        errors = []
        created_assets = []

        for idx, row in df.iterrows():
            row_errors = []
            try:
                category_name = str(row.get("category") or "").strip() or None
                location_name = str(row.get("location") or "").strip() or None
                department_name = str(row.get("department") or "").strip() or None
                vendor_name = str(row.get("vendor") or "").strip() or None

                if not category_name:
                    row_errors.append("category is required")
                if not location_name:
                    row_errors.append("location is required")
                if not department_name:
                    row_errors.append("department is required")

                if row_errors:
                    errors.append({"row": idx + 2, "message": "; ".join(row_errors)})
                    continue

                category = Category.objects.filter(name__iexact=category_name).first()
                if not category:
                    category = Category.objects.create(name=category_name)

                location = Location.objects.filter(name__iexact=location_name).first()
                if not location:
                    location = Location.objects.create(name=location_name, building="", floor="", room="")

                department = Department.objects.filter(department_name__iexact=department_name).first()
                if not department:
                    department = Department.objects.create(department_name=department_name)

                vendor = None
                if vendor_name:
                    vendor = Vendor.objects.filter(vendor_name__iexact=vendor_name).first()
                    if not vendor:
                        vendor = Vendor.objects.create(
                            vendor_name=vendor_name,
                            contact_person="",
                            email=f"vendor_{vendor_name.replace(' ', '_').lower()}@temp.com",
                            phone="",
                            address="",
                        )

                barcode_val = cls._val(row.get("barcode"))
                if not barcode_val:
                    barcode_val = BarcodeService.auto_generate_barcode(
                        cls._val(row.get("asset_code")),
                        cls._val(row.get("asset_name")),
                    )

                from assets.serializers import AssetSerializer
                data = {
                    "asset_code": cls._val(row.get("asset_code")),
                    "barcode": barcode_val,
                    "asset_name": cls._val(row.get("asset_name")),
                    "category": category.id,
                    "brand": cls._val(row.get("brand")),
                    "model_name": cls._val(row.get("model_name")),
                    "location": location.id,
                    "department": department.id,
                    "serial_number": str(cls._val(row.get("serial_number", ""))),
                    "model_detail": cls._val(row.get("model_detail")),
                    "manufacturer": cls._val(row.get("manufacturer")),
                    "invoice_number": cls._val(row.get("invoice_number")),
                    "status": cls._val(row.get("status"), "ACTIVE"),
                    "vendor": vendor.id if vendor else None,
                }

                serializer = AssetSerializer(data=data)
                if serializer.is_valid():
                    asset = serializer.save()
                    created_assets.append(asset)
                else:
                    msg = "; ".join(f"{k}: {', '.join(v)}" for k, v in serializer.errors.items())
                    errors.append({"row": idx + 2, "message": msg})

            except Exception as e:
                errors.append({"row": idx + 2, "message": str(e)})

        return created_assets, errors
