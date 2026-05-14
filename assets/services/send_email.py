import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
from datetime import date

from django.conf import settings

from reports.models import Report


def build_report_email(report: Report) -> MIMEMultipart:
    metrics = report.summary_data
    subject = f"Weekly Inventory Summary — {report.created_at.strftime('%B %d, %Y')}"

    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = settings.EMAIL_HOST_USER
    to_list = settings.REPORT_EMAIL_RECIPIENTS
    if report.generated_by and report.generated_by.email:
        to_list = list(set(to_list + [report.generated_by.email]))
    msg['To'] = ', '.join(to_list)

    token = report.download_token

    kpis = [
        ('Total Assets', metrics.get('total_assets', '-'), '#06b6d4'),
        ('Active', metrics.get('active_assets', '-'), '#22c55e'),
        ('Under Repair', metrics.get('under_repair', '-'), '#eab308'),
        ('Missing', metrics.get('missing_assets', '-'), '#ef4444'),
        ('Pending Proc.', metrics.get('pending_procurements', '-'), '#f97316'),
        ('Total Repairs', metrics.get('total_repairs', '-'), '#8b5cf6'),
    ]

    kpi_rows = ''
    for i, (label, value, color) in enumerate(kpis):
        if i % 2 == 0:
            kpi_rows += '<tr>'
        kpi_rows += f'''
        <td style="background:#0f172a;border-radius:8px;padding:12px;text-align:center;width:50%;">
            <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">{label}</div>
            <div style="color:{color};font-size:24px;font-weight:700;">{value}</div>
        </td>'''
        if i % 2 == 1:
            kpi_rows += '</tr>'
    if len(kpis) % 2 == 1:
        kpi_rows += '</tr>'

    html = f"""\
<html>
<body style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;padding:24px;margin:0;">
<table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;width:100%;">
<tr><td style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;">
    <h1 style="color:#06b6d4;font-size:22px;margin:0 0 4px;">Weekly Inventory Summary</h1>
    <p style="color:#64748b;font-size:12px;margin:0 0 20px;">{report.created_at.strftime('%A, %B %d, %Y')}</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        {kpi_rows}
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        <tr><td style="padding:0;">
            <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 8px;">Key Highlights</h3>
            <ul style="color:#94a3b8;font-size:12px;margin:0;padding-left:20px;">
                <li>{metrics.get('repairs_last_week', 0)} repair tickets created in the last 7 days</li>
                <li>{metrics.get('proc_last_week', 0)} new procurement requests this week</li>
                <li>{metrics.get('missing_assets', 0)} assets currently marked as missing</li>
            </ul>
        </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;">
        <tr><td style="text-align:center;">
            <img src="cid:chart" style="max-width:100%;border-radius:8px;" />
        </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;padding-top:16px;border-top:1px solid #334155;">
        <tr><td style="text-align:center;">
            <p style="color:#64748b;font-size:12px;margin:0 0 12px;">Download the full report:</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                    <td style="padding:4px;">
                        <a href="{settings.BASE_URL}/api/v1/reports/download/{token}/"
                           style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:600;">Download PDF</a>
                    </td>
                    <td style="padding:4px;">
                        <a href="{settings.BASE_URL}/api/v1/reports/download-excel/{token}/"
                           style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:8px 20px;border-radius:6px;font-size:12px;font-weight:600;">Download Excel</a>
                    </td>
                </tr>
            </table>
        </td></tr>
    </table>
</td></tr>
<tr><td style="text-align:center;padding-top:16px;">
    <p style="color:#334155;font-size:10px;">This report was automatically generated. — Inventory Management System</p>
</td></tr>
</table>
</body>
</html>"""

    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(html, 'html'))
    msg.attach(alt)

    if report.chart_data:
        image = MIMEImage(report.chart_data, _subtype='png')
        image.add_header('Content-ID', '<chart>')
        image.add_header('Content-Disposition', 'inline', filename='chart.png')
        msg.attach(image)

    if report.pdf_data:
        part = MIMEBase('application', 'pdf')
        part.set_payload(report.pdf_data.tobytes() if hasattr(report.pdf_data, 'tobytes') else bytes(report.pdf_data))
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=f"weekly_report_{report.created_at.strftime('%Y%m%d')}.pdf")
        msg.attach(part)

    if report.excel_data:
        part = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        part.set_payload(report.excel_data.tobytes() if hasattr(report.excel_data, 'tobytes') else bytes(report.excel_data))
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename=f"weekly_report_{report.created_at.strftime('%Y%m%d')}.xlsx")
        msg.attach(part)

    return msg


def send_report_email(report: Report) -> bool:
    if not settings.EMAIL_HOST_USER or not settings.REPORT_EMAIL_RECIPIENTS:
        return False

    msg = build_report_email(report)

    try:
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send report email: {e}")
        return False


def build_procurement_approval_email(procurement) -> MIMEMultipart:
    subject = f"Approval Required — Procurement Request {procurement.request_number}"

    msg = MIMEMultipart('mixed')
    msg['Subject'] = subject
    msg['From'] = settings.EMAIL_HOST_USER

    approvers = getattr(settings, 'PROCUREMENT_APPROVAL_EMAILS', None)
    if approvers:
        to_list = approvers
    else:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        to_list = list(
            User.objects.filter(role__in=('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), status='ACTIVE')
            .exclude(email='')
            .values_list('email', flat=True)
        )
    msg['To'] = ', '.join(to_list)

    token = procurement.approval_token
    approve_url = f"{settings.BASE_URL}/api/v1/procurements/approve-email/{token}/"
    reject_url = f"{settings.BASE_URL}/api/v1/procurements/reject-email/{token}/"

    assets_list = ''
    for asset in procurement.assets.all():
        assets_list += f'<li style="color:#94a3b8;font-size:12px;padding:2px 0;">{asset.asset_name} ({asset.asset_code})</li>'

    requested_by_name = procurement.requested_by.get_full_name() or procurement.requested_by.username
    department_name = procurement.department.department_name if procurement.department else 'N/A'

    html = f"""\
<html>
<body style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;padding:24px;margin:0;">
<table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;width:100%;">
<tr><td style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;">
    <h1 style="color:#f97316;font-size:20px;margin:0 0 4px;">Procurement Approval Required</h1>
    <p style="color:#64748b;font-size:12px;margin:0 0 20px;">Request #{procurement.request_number}</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        <tr>
            <td style="background:#0f172a;border-radius:8px;padding:12px;width:50%;">
                <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Requested By</div>
                <div style="color:#e2e8f0;font-size:14px;font-weight:600;">{requested_by_name}</div>
            </td>
            <td style="padding:4px;"></td>
            <td style="background:#0f172a;border-radius:8px;padding:12px;width:50%;">
                <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">Department</div>
                <div style="color:#e2e8f0;font-size:14px;font-weight:600;">{department_name}</div>
            </td>
        </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        <tr><td style="padding:0;">
            <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 8px;">Assets in this Request</h3>
            <ul style="margin:0;padding-left:20px;">
                {assets_list if assets_list else '<li style="color:#94a3b8;font-size:12px;">No assets linked</li>'}
            </ul>
        </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
        <tr><td style="padding:0;">
            <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 8px;">Remarks</h3>
            <p style="color:#94a3b8;font-size:12px;margin:0;">{procurement.remarks or 'None'}</p>
        </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:20px;padding-top:16px;border-top:1px solid #334155;">
        <tr><td style="text-align:center;">
            <p style="color:#64748b;font-size:12px;margin:0 0 12px;">Review and take action:</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                    <td style="padding:4px;">
                        <a href="{approve_url}"
                           style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;">Approve</a>
                    </td>
                    <td style="padding:4px;">
                        <a href="{reject_url}"
                           style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;">Reject</a>
                    </td>
                </tr>
            </table>
        </td></tr>
    </table>
</td></tr>
<tr><td style="text-align:center;padding-top:16px;">
    <p style="color:#334155;font-size:10px;">This is an automated notification from the Inventory Management System.</p>
</td></tr>
</table>
</body>
</html>"""

    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(html, 'html'))
    msg.attach(alt)

    return msg


def send_procurement_approval_email(procurement) -> bool:
    if not settings.EMAIL_HOST_USER:
        return False

    msg = build_procurement_approval_email(procurement)

    try:
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send procurement approval email: {e}")
        return False


def send_new_asset_email(assets_qs, department) -> bool:
    if not settings.EMAIL_HOST_USER:
        return False

    from accounts.models import User
    if not department:
        return False
    admins = User.objects.filter(department=department, role="DEPARTMENT_ADMIN").exclude(email='')
    if not admins:
        return False

    import io
    from openpyxl import Workbook

    asset_list = list(assets_qs.select_related('category', 'location').only(
        'asset_code', 'asset_name', 'brand', 'model_name', 'serial_number',
        'status', 'created_at', 'approval_token',
        'category__name', 'location__name',
    ))
    if not asset_list:
        return False

    wb = Workbook()
    ws = wb.active
    ws.title = "Pending Assets"
    headers = ["Asset Code", "Asset Name", "Category", "Brand", "Model",
               "Serial Number", "Location", "Status", "Created At"]
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        ws.column_dimensions[chr(64 + col_idx)].width = 20

    count = len(asset_list)

    for asset in asset_list:
        ws.append([
            asset.asset_code,
            asset.asset_name,
            asset.category.name,
            asset.brand,
            asset.model_name,
            asset.serial_number,
            asset.location.name,
            asset.get_status_display(),
            asset.created_at.strftime('%Y-%m-%d'),
        ])

    excel_output = io.BytesIO()
    wb.save(excel_output)
    excel_output.seek(0)

    msg = MIMEMultipart('mixed')
    msg['Subject'] = f"Approval Required — {count} Asset(s) Pending in {department.department_name}"
    msg['From'] = settings.EMAIL_HOST_USER
    msg['To'] = ', '.join([u.email for u in admins])

    asset_rows = ''
    for asset in asset_list:
        approve_url = f"{settings.BASE_URL}/api/v1/assets/approve-email/{asset.approval_token}/"
        reject_url = f"{settings.BASE_URL}/api/v1/assets/reject-email/{asset.approval_token}/"
        asset_rows += f'''<tr>
    <td style="padding:8px;border-bottom:1px solid #334155;color:#e2e8f0;font-size:12px;">{asset.asset_code}</td>
    <td style="padding:8px;border-bottom:1px solid #334155;color:#e2e8f0;font-size:12px;">{asset.asset_name}</td>
    <td style="padding:8px;border-bottom:1px solid #334155;color:#e2e8f0;font-size:12px;">{asset.category.name}</td>
    <td style="padding:8px;border-bottom:1px solid #334155;font-size:12px;text-align:center;">
        <a href="{approve_url}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;">Approve</a>
        <a href="{reject_url}" style="display:inline-block;background:#ef4444;color:#fff;text-decoration:none;padding:4px 12px;border-radius:4px;font-size:11px;font-weight:600;margin-left:4px;">Reject</a>
    </td>
</tr>'''

    html = f"""\
<html>
<body style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;padding:24px;margin:0;">
<table cellpadding="0" cellspacing="0" style="max-width:700px;margin:0 auto;width:100%;">
<tr><td style="background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;">
    <h1 style="color:#f97316;font-size:20px;margin:0 0 4px;">Asset Approval Required</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px;">
        <strong style="color:#e2e8f0;">{count}</strong> new asset(s) have been registered in
        <strong style="color:#e2e8f0;">{department.department_name}</strong> and require your approval.
        The full list is attached as an Excel file.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:8px;">
        <thead>
            <tr style="background:#0f172a;">
                <th style="padding:8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;letter-spacing:0.5px;">Code</th>
                <th style="padding:8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;letter-spacing:0.5px;">Name</th>
                <th style="padding:8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;letter-spacing:0.5px;">Category</th>
                <th style="padding:8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:center;letter-spacing:0.5px;">Action</th>
            </tr>
        </thead>
        <tbody>
            {asset_rows}
        </tbody>
    </table>
</td></tr>
<tr><td style="text-align:center;padding-top:16px;">
    <p style="color:#334155;font-size:10px;">This is an automated notification from the Inventory Management System.</p>
</td></tr>
</table>
</body>
</html>"""

    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(html, 'html'))
    msg.attach(alt)

    xlsx_part = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    xlsx_part.set_payload(excel_output.getvalue())
    encoders.encode_base64(xlsx_part)
    xlsx_part.add_header('Content-Disposition', 'attachment', filename=f"pending_assets_{department.code or department.department_name}.xlsx")
    msg.attach(xlsx_part)

    try:
        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to send new asset email: {e}")
        return False
