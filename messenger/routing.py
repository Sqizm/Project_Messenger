from django.urls import re_path
from .consumers import ChatConsumer, UserListConsumer

ws_urlpatterns = [
    re_path(r'ws/chat/(?P<room_name>\w+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/customuser/(?P<user1_id>\w+)/(?P<user2_id>\w+)/$', UserListConsumer.as_asgi()),
]
