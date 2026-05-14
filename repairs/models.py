# Tracks repair tickets for assets that need fixing
# Each ticket links to an asset and tracks its repair journey
from django.db import models
from assets.models import Asset, Document


class RepairTicket(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    issue_description = models.TextField()
    repair_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=50)
    start_date = models.DateTimeField(auto_now_add=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    bill_documents = models.ManyToManyField(Document, blank=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"#{self.id} - {self.asset.asset_code} ({self.status})"
