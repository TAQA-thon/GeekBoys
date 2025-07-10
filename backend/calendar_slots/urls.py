from django.urls import path
from . import views

app_name = 'calendar_slots'

urlpatterns = [
    # Calendar slots
    path('', views.FactoryCalendarListView.as_view(), name='calendar-list'),
    path('<uuid:pk>/', views.FactoryCalendarDetailView.as_view(), name='calendar-detail'),
    
    # Special views
    path('overview/', views.calendar_overview_view, name='calendar-overview'),
    path('bulk-create/', views.bulk_create_slots_view, name='bulk-create-slots'),
    path('availability/', views.slot_availability_view, name='slot-availability'),
] 