from .models import *
from rest_framework import serializers
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from rest_framework.status import HTTP_403_FORBIDDEN


class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'password', 'avatar']
        extra_kwargs = {'password': {'write_only': True}}

    @staticmethod
    def create(validated_data):
        if 'avatar' not in validated_data or not validated_data['avatar']:
            validated_data['avatar'] = 'def_avatar.png'

        user = CustomUser(email=validated_data['email'],
                          username=validated_data['username'],
                          avatar=validated_data['avatar'])
        user.set_password(validated_data['password'])
        user.save()
        return user


class ChatSerializer(serializers.HyperlinkedModelSerializer):
    creator = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all())
    creator_username = serializers.CharField(source='creator.username', read_only=True)  # Для отобр. ника создателя.

    class Meta:
        model = Chat
        fields = ['id', 'name', 'avatar', 'creator', 'creator_username', 'participant', 'messages']


class MessageSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'text', 'author', 'created_at']
