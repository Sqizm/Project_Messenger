from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.serializers.json import DjangoJSONEncoder
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

        # Загружаем историю сообщений
        chat_history = await self.load_chat_history(self.room_name)
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': chat_history
        }))

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

        chat = await self.get_chat(chat_id)

        await self.save_message(message, participant['id'], chat)

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

    # Сохраняем сообщение от пользователя в бд.
    @database_sync_to_async
    def save_message(self, text, author_id, chat_id):
        # chat = Chat.objects.get(id=chat_id)
        author = CustomUser.objects.get(id=author_id)
        message = Message.objects.create(text=text, author=author)
        chat_id.messages.add(message)

    @database_sync_to_async
    def load_chat_history(self, room_name):
        try:
            chat_id = int(room_name)
            chat = Chat.objects.get(id=chat_id)
            messages = chat.messages.all().order_by('created_at')
            return [
                {
                    'id': message.id,
                    'text': message.text,
                    'author': {
                        'id': message.author.id,
                        'username': message.author.username
                    }
                    # 'created_at': message.created_at.isoformat()
                }
                for message in messages
            ]
        except (ValueError, Chat.DoesNotExist):
            return []


# Обработчик для диалогов между пользователями!.
class UserListConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user1_id = self.scope['url_route']['kwargs']['user1_id']
        self.user2_id = self.scope['url_route']['kwargs']['user2_id']
        self.room_name_1 = f'chat_room_{self.user1_id}_{self.user2_id}'
        self.room_name_2 = f'chat_room_{self.user2_id}_{self.user1_id}'

        # Присоединяемся к каналам, соответствующим обоим пользователям
        await self.channel_layer.group_add(
            self.room_name_1,
            self.channel_name
        )
        await self.channel_layer.group_add(
            self.room_name_2,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Покидаем каналы, соответствующие обоим пользователям
        await self.channel_layer.group_discard(
            self.room_name_1,
            self.channel_name
        )
        await self.channel_layer.group_discard(
            self.room_name_2,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        action = text_data_json.get('action')

        if action == 'fetch_message_history':
            user1_id = text_data_json.get('user1_id')
            user2_id = text_data_json.get('user2_id')
            message_history = await self.fetch_message_history(user1_id, user2_id)
            await self.send_message_history(message_history)
        else:
            sender_id = text_data_json.get('sender_id')
            receiver_id = text_data_json.get('receiver_id')

            if 'message' in text_data_json:
                message = text_data_json['message']
                # Получаем объекты пользователей
                sender = await self.get_user_by_id(sender_id)
                receiver = await self.get_user_by_id(receiver_id)
                # Сохраняем сообщение в базу данных
                await self.save_message(message, sender, receiver)
                # Отправляем сообщение только в канал, где receiver_id совпадает с self.user_id
                if str(receiver_id) == str(self.user1_id):
                    await self.channel_layer.group_send(
                        self.room_name_1,
                        {
                            'type': 'chat_message',
                            'message': message,
                            'sender_id': sender_id,
                            'receiver_id': receiver_id
                        }
                    )
                elif str(receiver_id) == str(self.user2_id):
                    await self.channel_layer.group_send(
                        self.room_name_2,
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

    # Получаем id пользователя.
    async def get_user_by_id(self, user_id):
        return await CustomUser.objects.aget(id=user_id)

    # Сохраняем сообщение от пользователя в бд.
    @database_sync_to_async
    def save_message(self, text, sender, receiver):
        message = Message(
            text=text,
            author=sender,
            recipient=receiver.id,
        )
        message.save()

    async def fetch_message_history(self, user1_id, user2_id):
        message_history = await self.get_message_history_from_database(user1_id, user2_id)
        return message_history

    async def send_message_history(self, message_history):
        serialized_message_history = []
        for message in message_history:
            serialized_message = {
                'text': message['text'],
                'author': {
                    'id': message['author'].id,
                    'username': message['author'].username
                },
                'recipient': message['recipient']
            }
            serialized_message_history.append(serialized_message)

        await self.send(text_data=json.dumps({
            'action': 'message_history',
            'data': serialized_message_history
        }, cls=DjangoJSONEncoder))

    @database_sync_to_async
    def get_message_history_from_database(self, user1_id, user2_id):
        message_history_user1_to_user2 = Message.objects.filter(author=user1_id, recipient=user2_id).all()

        message_history_user2_to_user1 = Message.objects.filter(author=user2_id, recipient=user1_id).all()

        message_history = sorted(list(message_history_user1_to_user2) + list(message_history_user2_to_user1),
                                 key=lambda x: x.created_at)

        serialized_message_history = [
            {'text': message.text, 'author': message.author, 'recipient': message.recipient,
             } for message in message_history]

        return serialized_message_history
