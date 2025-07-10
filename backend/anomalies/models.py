from django.db import models
from django.conf import settings
import uuid


class Section(models.Model):
    """
    Department responsible for handling anomalies.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Anomaly(models.Model):
    """
    Anomaly detected in the factory that needs to be scheduled for maintenance.
    """
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('rescheduled', 'Rescheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    CONDITION_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    description = models.TextField()
    equipment_id = models.UUIDField()
    system_id = models.UUIDField()
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True)
    criticality = models.PositiveIntegerField(help_text="Criticality level (1-5)")
    estimated_duration = models.PositiveIntegerField(help_text="Estimated duration in hours")
    date_detected = models.DateTimeField()
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='medium')
    scheduled_slot = models.ForeignKey('calendar_slots.FactoryCalendar', null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    scheduled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Additional fields for tracking
    priority_score = models.PositiveIntegerField(null=True, blank=True, help_text="Calculated priority score")
    notes = models.TextField(blank=True)
    is_emergency = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_detected']
        verbose_name_plural = 'Anomalies'

    def __str__(self):
        return f"Anomaly {self.id} - {self.description[:50]}"

    def save(self, *args, **kwargs):
        # Calculate priority score if not set
        if not self.priority_score:
            self.calculate_priority_score()
        super().save(*args, **kwargs)

    def calculate_priority_score(self):
        """
        Calculate priority score based on criticality and condition.
        """
        condition_scores = {
            'critical': 5,
            'high': 4,
            'medium': 3,
            'low': 2,
        }
        
        condition_score = condition_scores.get(self.condition, 3)
        self.priority_score = self.criticality * condition_score

    @property
    def is_high_priority(self):
        """Check if anomaly is high priority (score >= 15)."""
        return self.priority_score and self.priority_score >= 15

    @property
    def is_overdue(self):
        """Check if anomaly is overdue (30+ days since detection)."""
        from django.utils import timezone
        from datetime import timedelta
        return self.date_detected < (timezone.now() - timedelta(days=30))
