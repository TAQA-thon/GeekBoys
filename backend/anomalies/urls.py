from django.urls import path
from . import views

app_name = 'anomalies'

urlpatterns = [
    # Sections
    path('sections/', views.SectionListView.as_view(), name='section-list'),
    path('sections/<uuid:pk>/', views.SectionDetailView.as_view(), name='section-detail'),
    
    # Anomalies
    path('', views.AnomalyListView.as_view(), name='anomaly-list'),
    path('<uuid:pk>/', views.AnomalyDetailView.as_view(), name='anomaly-detail'),
    path('<uuid:pk>/reschedule/', views.AnomalyRescheduleView.as_view(), name='anomaly-reschedule'),
    
    # Special views
    path('unassigned/', views.unassigned_anomalies_view, name='unassigned-anomalies'),
    path('scheduled/', views.scheduled_anomalies_view, name='scheduled-anomalies'),
    path('overdue/', views.overdue_anomalies_view, name='overdue-anomalies'),
    path('high-priority/', views.high_priority_anomalies_view, name='high-priority-anomalies'),
    path('section/<uuid:section_id>/', views.anomalies_by_section_view, name='anomalies-by-section'),

    # Anomalies by system
    path('system/<str:unit_id>/', views.anomalies_by_system_view, name='anomalies-by-system'),
    path('system/<str:unit_id>/count/', views.anomalies_by_system_count_view, name='anomalies-by-system-count'),
    
    # Import and scheduling
    path('import/', views.import_anomalies_view, name='import-anomalies'),
    path('auto-schedule/', views.auto_schedule_all_view, name='auto-schedule-all'),
    
    # MongoDB endpoints
    path('mongodb/', views.mongodb_anomalies_view, name='mongodb-anomalies'),
    path('mongodb/statistics/', views.mongodb_statistics_view, name='mongodb-statistics'),
    path('mongodb/count/', views.mongodb_anomaly_count_view, name='mongodb-anomaly-count'),
    path('mongodb/units/count/', views.mongodb_unit_count_view, name='mongodb-unit-count'),
    path('mongodb/unapproved-anomalies/', views.paginated_unapproved_anomalies_view, name='paginated-unapproved-anomalies'),
    # Approved anomalies queue
    path('mongodb/approved-queue/', views.mongodb_approved_queue_view, name='mongodb-approved-queue'),
    path('mongodb/approved-queue/check/', views.mongodb_check_schedule_queue_view, name='mongodb-check-schedule-queue'),
    path('mongodb/approved-queue/<str:anomaly_id>/', views.mongodb_remove_from_queue_view, name='mongodb-remove-from-queue'),

    # import time slotsRach1999
    path('mongodb/time-slots/import/', views.mongodb_time_slots_import_view, name='mongodb-time-slots-import'),
    path('mongodb/time-slots/', views.mongodb_time_slots_list_view, name='mongodb-time-slots-list'),
    path('mongodb/time-slots/create/', views.mongodb_time_slot_create_view, name='mongodb-time-slot-create'),
    path('mongodb/time-slots/<str:slot_id>/', views.mongodb_time_slot_update_view, name='mongodb-time-slot-update'),
    path('mongodb/time-slots/<str:slot_id>/reschedule/', views.mongodb_time_slot_reschedule_view, name='mongodb-time-slot-reschedule'),
    path('mongodb/time-slots/<str:slot_id>/delete/', views.mongodb_time_slot_delete_view, name='mongodb-time-slot-delete'),
    path('mongodb/time-slots/<str:slot_id>/anomalies/', views.slot_scheduled_anomalies_view, name='slot-scheduled-anomalies'),
  
  
    path('mongodb/<str:anomaly_id>/approve/', views.mongodb_approve_anomaly_view, name='mongodb-approve-anomaly'),
    path('mongodb/<str:anomaly_id>/edit/', views.mongodb_edit_anomaly_view, name='mongodb-edit-anomaly'),
    path('mongodb/<str:anomaly_id>/status/', views.mongodb_update_anomaly_status_view, name='mongodb-update-anomaly-status'),
    path('mongodb/<str:anomaly_id>/', views.mongodb_anomaly_detail_view, name='mongodb-anomaly-detail'),
    
    # API endpoints for frontend (removed duplicate - using report/analytics/ instead)
    # path('api/analytics/', views.mongodb_analytics_view, name='mongodb_analytics'),

    # Report endpoints
    path('report/summary/', views.report_summary_view, name='report-summary'),
    path('report/trends/', views.report_trends_view, name='report-trends'),
    path('report/yearly-trends/', views.yearly_anomaly_trends_view, name='yearly-trends'),
    path('report/by-status/', views.report_by_status_view, name='report-by-status'),
    path('report/by-criticality/', views.report_by_criticality_view, name='report-by-criticality'),
    path('report/by-section/', views.report_by_section_view, name='report-by-section'),

    # an
    path('report/analytics/', views.analytics_view, name='analytics_view'),
    path('earliest-date/', views.earliest_anomaly_date_view, name='earliest_anomaly_date'),
    path('debug-data/', views.debug_data_view, name='debug_data'),

]