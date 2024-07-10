from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login
from rest_framework import viewsets, generics
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.status import (HTTP_200_OK, HTTP_401_UNAUTHORIZED,
                                   HTTP_201_CREATED, HTTP_400_BAD_REQUEST,
                                   HTTP_204_NO_CONTENT, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND)
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import *
from .models import *


# ViewSet'ы для модель.
class CustomUserViewset(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def list(self, request):
        user = request.user
        serializer = CustomUserSerializer(user)
        return Response(serializer.data)

    def update(self, request, pk=None):
        user = CustomUser.objects.get(pk=pk)
        serializer = CustomUserSerializer(user, data=request.data, partial=True)
        print(f'user: {user}')
        print(f'request.data: {request.data}')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_200_OK)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class ChatViewset(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.creator == request.user:  # Проверка на создателя чата
            self.perform_destroy(instance)
            return Response(status=HTTP_204_NO_CONTENT)
        else:
            return Response({'error': 'Вы не можете удалить этот чат, так как вы не являетесь его создателем.'},
                            status=HTTP_403_FORBIDDEN)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        print(f'instance: {instance}')
        print(f'request.data: {request.data}')
        if instance.creator == request.user:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        else:
            return Response({'error': 'Вы не можете обновить этот чат, так как вы не являетесь его создателем.'},
                            status=HTTP_403_FORBIDDEN)


class MessageViewset(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAdminUser]


# ViewSet'ы для пользователя.
class RegisterUserView(APIView):
    permission_classes = [AllowAny]

    @staticmethod
    def get(request):
        return render(request, 'accounts/signup.html')

    @staticmethod
    def post(request):
        serializer = CustomUserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=HTTP_201_CREATED)
        return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)


class SignInUserView(APIView):  # viewsets.GenericViewSet
    @staticmethod
    def get(request):
        return render(request, 'accounts/signin.html')

    @staticmethod
    def post(request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            login(request, user)
            return Response({'message': 'Успешный вход', 'redirect_url': '/chats/'}, status=HTTP_200_OK)
        else:
            return Response({'error': 'Неверное имя пользователя или пароль'}, status=HTTP_401_UNAUTHORIZED)


class UserViewAll(viewsets.ViewSet):
    @staticmethod
    def list(request):
        users = CustomUser.objects.exclude(id=request.user.id)
        serializer = CustomUserSerializer(users, many=True)
        return Response(serializer.data)


# ViewSet'ы для групповых чатов.
class ChatView(APIView):
    @staticmethod
    def get(request):
        if request.user.is_authenticated:
            return render(request, 'chats.html')
        else:
            return redirect('login_api')


class RegisterChatView(generics.CreateAPIView):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        if 'avatar' not in self.request.data or not self.request.data['avatar']:
            serializer.validated_data['avatar'] = 'def_channel.png'
        serializer.save(creator=self.request.user)
        chat = serializer.instance
        chat.participant.add(chat.creator)
        return chat
