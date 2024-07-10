from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
import json
from .models import Chat, CustomUser, Message


# Обработчик для групповых чатов.
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope['user']

        # Проверяем, существует ли чат
        chat = await self.get_chat(self.room_name)
        if chat:
            # Проверяем, является ли пользователь участником чата
            is_participant = await self.is_user_participant(chat)
            if not is_participant:
                # Добавляем пользователя в участники чата
                await self.add_user_to_chat(chat)

            # Присоединяемся к группе чата
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
        else:
            await self.close()

    @database_sync_to_async
    def get_chat(self, room_name):
        try:
            chat_id = int(room_name)
            return Chat.objects.get(id=chat_id)
        except (ValueError, Chat.DoesNotExist):
            return None

    @database_sync_to_async
    def is_user_participant(self, chat):
        return self.user in chat.participant.all()

    @database_sync_to_async
    def add_user_to_chat(self, chat):
        chat.participant.add(self.user)
        chat.save()

    async def disconnect(self, close_code):
        # Покидаем группу чата
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Получение сообщения от WebSocket
    async def receive(self, text_data=None, bytes_data=None):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        chat_id = text_data_json['chatId']
        participant = {
            'username': self.scope['user'].username,
            'id': self.scope['user'].id
        }
        print(f'Received message: {message}, chatId: {chat_id}')

        # Обработка сообщения и отправка его обратно в группу
        await self.channel_layer.group_send(
            f'chat_{chat_id}',
            {
                'type': 'chat_message',
                'message': message,
                'chatId': chat_id,
                'participant': participant
            }
        )

    # Обработка сообщения, полученного от группы
    async def chat_message(self, event):
        message = event['message']
        chat_id = event['chatId']
        participant = event['participant']

        # Отправка сообщения клиенту
        await self.send(text_data=json.dumps({
            'message': message,
            'chatId': chat_id,
            'participant': participant
        }))


# Обработчик для диалогов между пользователями!.
class UserListConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user1_id = self.scope['url_route']['kwargs']['user1_id']
        self.user2_id = self.scope['url_route']['kwargs']['user2_id']

        # Присоединяемся к каналам, соответствующим обоим пользователям
        await self.channel_layer.group_add(
            f'user_{self.user1_id}',
            self.channel_name
        )
        await self.channel_layer.group_add(
            f'user_{self.user2_id}',
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Покидаем каналы, соответствующие обоим пользователям
        await self.channel_layer.group_discard(
            f'user_{self.user1_id}',
            self.channel_name
        )
        await self.channel_layer.group_discard(
            f'user_{self.user2_id}',
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']
        sender_id = text_data_json['sender_id']
        receiver_id = text_data_json['receiver_id']

        # Отправляем сообщение другому пользователю
        await self.channel_layer.group_send(
            f'user_{receiver_id}',
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': sender_id,
                'receiver_id': receiver_id
            }
        )

    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']
        receiver_id = event['receiver_id']

        # Отправляем сообщение в WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender_id': sender_id,
            'receiver_id': receiver_id
        }))
