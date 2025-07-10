from django.contrib import admin
from .models import Section, Anomaly


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at', 'updated_at')
    search_fields = ('name', 'description')
    ordering = ('name',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'description', 'section', 'criticality', 'estimated_duration',
        'condition', 'status', 'scheduled_slot', 'priority_score', 'is_emergency',
        'date_detected', 'created_at'
    )
    list_filter = (
        'status', 'condition', 'section', 'is_emergency', 'criticality',
        'date_detected', 'created_at'
    )
    search_fields = ('description', 'notes', 'equipment_id', 'system_id')
    readonly_fields = ('id', 'priority_score', 'created_at', 'updated_at')
    ordering = ('-date_detected',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('description', 'equipment_id', 'system_id', 'section')
        }),
        ('Priority & Duration', {
            'fields': ('criticality', 'estimated_duration', 'condition', 'priority_score')
        }),
        ('Scheduling', {
            'fields': ('scheduled_slot', 'status', 'scheduled_by', 'is_emergency')
        }),
        ('Timestamps', {
            'fields': ('date_detected', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('section', 'scheduled_slot', 'scheduled_by')
