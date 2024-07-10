from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    avatar = models.ImageField(upload_to='avatars', default='def_avatar.png', null=True, blank=True)
    friend_s = models.ManyToManyField('self', symmetrical=True, related_query_name='friends')
    chat_s = models.ManyToManyField('Chat', related_name='participants')


class Chat(models.Model):
    name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='channel_avat', default='def_channel.png', null=True, blank=True)
    creator = models.ForeignKey(CustomUser, null=True, on_delete=models.CASCADE)
    participant = models.ManyToManyField(CustomUser, blank=True, related_name='chats')
    messages = models.ManyToManyField('Message', blank=True, related_name='chat')

    def __str__(self):
        return f'Название: {self.name} Создатель: {self.creator}'

    def add_participant(self, user):
        return self.participant.add(user)

    def remove_participant(self, user):
        return self.participant.remove(user)


class Message(models.Model):
    text = models.TextField()
    author = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='messages')
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages', default=None)
    created_at = models.DateTimeField(auto_now_add=True)
