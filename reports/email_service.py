import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from email import encoders
from datetime import date

from django.conf import settings

from .models import Report


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
