from django.db import migrations, models


def migrate_pending_blocked_assets(apps, schema_editor):
    Asset = apps.get_model("assets", "Asset")
    Asset.objects.filter(
        approval_status="PENDING",
        status="BLOCKED",
    ).update(status="PROCUREMENT")


def reverse_pending_procurement_assets(apps, schema_editor):
    Asset = apps.get_model("assets", "Asset")
    Asset.objects.filter(
        approval_status="PENDING",
        status="PROCUREMENT",
    ).update(status="BLOCKED")


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0006_asset_approval_token"),
    ]

    operations = [
        migrations.AlterField(
            model_name="asset",
            name="status",
            field=models.CharField(
                choices=[
                    ("PROCUREMENT", "Under Procurement"),
                    ("ACTIVE", "Active"),
                    ("REPAIR", "Under Repair"),
                    ("MISSING", "Missing"),
                    ("RETIRED", "Retired"),
                    ("BLOCKED", "Blocked"),
                ],
                db_index=True,
                default="PROCUREMENT",
                max_length=20,
            ),
        ),
        migrations.RunPython(
            migrate_pending_blocked_assets,
            reverse_pending_procurement_assets,
        ),
    ]
