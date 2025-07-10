from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Allow access only to admin users.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsManager(BasePermission):
    """
    Allow access only to manager users.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'manager')


class IsAdminOrManager(BasePermission):
    """
    Allow access to both admin and manager users.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ['admin', 'manager']
        )


class IsAdminOrReadOnly(BasePermission):
    """
    Allow read access to all users, but write access only to admin users.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')


class IsOwnerOrAdmin(BasePermission):
    """
    Allow access to object owner or admin users.
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access everything
        if request.user.role == 'admin':
            return True
        
        # Check if the object has a user field
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        elif hasattr(obj, 'scheduled_by'):
            return obj.scheduled_by == request.user
        
        return False 