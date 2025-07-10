from django.contrib import admin
from .models import FactoryCalendar


@admin.register(FactoryCalendar)
class FactoryCalendarAdmin(admin.ModelAdmin):
    list_display = (
        'date', 'available_hours', 'is_available', 'used_hours_display',
        'remaining_hours_display', 'utilization_percentage_display',
        'scheduled_anomalies_count_display'
    )
    list_filter = ('is_available', 'date')
    search_fields = ('notes',)
    ordering = ('date',)
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('date', 'available_hours', 'is_available')
        }),
        ('Utilization', {
            'fields': ('used_hours_display', 'remaining_hours_display', 'utilization_percentage_display'),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def used_hours_display(self, obj):
        return obj.get_used_hours()
    used_hours_display.short_description = 'Used Hours'
    
    def remaining_hours_display(self, obj):
        return obj.get_remaining_hours()
    remaining_hours_display.short_description = 'Remaining Hours'
    
    def utilization_percentage_display(self, obj):
        return f"{obj.utilization_percentage:.1f}%"
    utilization_percentage_display.short_description = 'Utilization %'
    
    def scheduled_anomalies_count_display(self, obj):
        from anomalies.models import Anomaly
        return Anomaly.objects.filter(scheduled_slot=obj).count()
    scheduled_anomalies_count_display.short_description = 'Scheduled Anomalies'
