"""
URL configuration for Project_Messenger project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework import routers
from messenger import views
from django.conf import settings
from django.conf.urls.static import static

router = routers.DefaultRouter()
router.register(r'customuser', views.CustomUserViewset)
router.register(r'chat', views.ChatViewset)
router.register(r'message', views.MessageViewset)
router.register(r'users', views.UserViewAll, basename='users')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('pages/', include('django.contrib.flatpages.urls')),
    path('', include(router.urls)),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('signup/', views.RegisterUserView.as_view(), name='register_api'),
    path('signin/', views.SignInUserView.as_view(), name='login_api'),
    path('logout/', views.logout_view, name='logout'),
    path('chats/', views.ChatView.as_view(), name='chats'),
    path('api/create_chat/', views.RegisterChatView.as_view(), name='create_chat_api'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
